const path = require("path");
const fs = require("fs-extra");
const gulp = require("gulp");
const gutil = require("gulp-util");
const concat = require("gulp-concat");
const insert = require("gulp-insert");
const rename = require("gulp-rename");
const argv = require("yargs").argv;
const map = require("vinyl-map2");
const del = require("del");
const _ = require("lodash/fp");
const convertEncoding = require("gulp-convert-encoding");
const data = require("gulp-data");
const todo = require("gulp-todo");
const template = require("gulp-template");
const chalk = require("chalk");
const globBase = require("glob-base");
const inquirer = require("inquirer");
const multiDest = require("gulp-multi-dest");
const Table = require("cli-table");

const utils = require("./config/utils/utility");
const git = require("./config/utils/git");
const base = require("./config/utils/base");
const db = require("./config/utils/db");

let config = utils.config;

const generateChangeLog = function(paths) {
  // Create Db objects from paths array
  let dbo = paths.map(path => {
    let obj = utils.getDBObjectFromPath(path);
    let exclude = path.startsWith("!");
    // return {...obj, exclude};
    return Object.assign({}, obj, { exclude });
  });

  // Group to structure:
  // { "owner": { "objectType": [ 'objectName' ] }}
  let o = _.pipe(
    _.groupBy("owner"),
    _.mapValues(
      _.pipe(
        _.groupBy("objectType"),
        _.mapValues(_.map("objectName"))
      )
    )
  )(dbo);

  // Build changelog
  let c = "";
  for (let owner in o) {
    c = `${c}### ${owner}\n`;
    for (let i_objectType in o[owner]) {
      let objectType = o[owner][i_objectType];
      c = `${c}#### ${i_objectType}\n`;
      objectType.forEach(val => {
        c = `${c}- ${val}\n`;
      });
      c = `${c}\n`;
    }
  }

  return c;
};

const timestampHeader = `-- File created: ${new Date()}
`;

const addDBObjectPrompt = (code, file, done) => {
  const obj = utils.getDBObjectFromPath(file);

  const prompt = `
PROMPT ***********************************************************
PROMPT ${obj.owner}: {${obj.objectType}} ${obj.objectName}
PROMPT ***********************************************************
`;

  // Append slash char (/) to execute block in sqlplus to Source files
  const ending = obj.isSource ? "\n/" : "";

  done(null, prompt + code + ending);
};

const packageSrcFromFile = () => {
  const deployPrepend = `
SPOOL deploy.log
SET FEEDBACK ON
SET ECHO ON
SET VERIFY OFF
SET DEFINE OFF
`;
  const deployAppend = `
COMMIT;
SPOOL OFF
`;

  const deployFile = path.basename(config.get("package.output"));
  const deployDir = path.dirname(config.get("package.output"));

  const src = config.get("package.input");
  const encoding = config.get("package.encoding");

  const templateObject = {
    config: config.get(),
    data: {
      // Dates in format YYYY-MM-DD
      now: new Date().toISOString().substring(0, 10)
    }
  };

  const templating = config.get("package.templating");

  return (
    gulp
      .src(src)
      // Replace template variables, ex. config["config.variable"]
      .pipe(templating ? template(templateObject) : gutil.noop())
      // Adds object prompt to every file
      .pipe(map(addDBObjectPrompt))
      .pipe(concat(deployFile))
      .pipe(insert.wrap(deployPrepend, deployAppend))
      .pipe(insert.prepend(timestampHeader))
      .pipe(convertEncoding({ to: encoding }))
      .pipe(gulp.dest(deployDir))
      .on("end", () => console.log(chalk.green("Package created.")))
  );
};

const createDeployInputFromGit = async () => {
  try {
    // Get changes file paths from git history
    let firstCommit = await git.getFirstCommitOnBranch();
    const stdout = await git.getCommitedFilesSincePoint(firstCommit.trim());
    const newInput = base.fromStdoutToFilesArray(stdout).sort();

    if (newInput.length === 0) {
      console.log(`No changed files found or no tagged commit to start from.`);
      return;
    }

    // Get saved package input from config file
    config.load();
    let savedInput = _.clone(config.get("package.input") || []).sort();

    if (_.isEqual(savedInput, newInput)) {
      console.log(`No new file paths added to package input.`);
      return;
    }

    // Save new input to config
    config.set("package.input", newInput);
    console.log(
      `${chalk.green("Changed file paths:")} ${newInput} ${chalk.green(
        "saved to package input."
      )}`
    );
  } catch (error) {
    console.error(error.message);
    console.error("Probably no commits or tags. Create some.");
  }
};

/*
 * Merge task (-t) from branch (-b) to current branch.
 * Usage ex. -t XXXX-5123 -b version-5.1.0
 **/
const cherryPickFromJiraTask = async () => {
  const branch = argv.b || "develop";
  const task = argv.t;
  if (task == null) throw Error("Task cannot be empty. ex. -t XXXX-1234");

  const stdout = await git.cherryPickByGrepAndBranch(task, branch);
  console.log(`Files changed: ${stdout}`);
};

const makeChangeLog = () => {
  const file = path.join(__dirname, "/config/templates/changelog*.md");
  // Generate change log from deploy input array
  const all = base.fromGlobsToFilesArray(config.get("package.input"));
  const content = generateChangeLog(all); // await git.getChangeLog();
  const templateObject = {
    config: config.get(),
    data: {
      // Dates in format YYYY-MM-DD
      now: new Date().toISOString().substring(0, 10)
    }
  };
  // Add changelog to template object
  templateObject.data.content = content;
  return gulp
    .src(file)
    .pipe(template(templateObject))
    .pipe(insert.prepend("<!---\n" + timestampHeader + "-->\n"))
    .pipe(rename("changelog.md"))
    .pipe(gulp.dest("./"));
};

const exportFilesFromDb = async ({
  file = argv.file,
  env = argv.env,
  changed = argv.changed,
  ease = argv.ease,
  quiet = argv.quiet
}) => {
  const src =
    file || (changed ? await getOnlyChangedFiles() : config.get("source"));

  const processFile = async (code, file, done) => {
    let res;
    try {
      res = await base.exportFile(code, file, env, ease, done);
      if (!quiet && res.exported)
        console.log(
          `${chalk.green("Imported")} <= ${res.obj.owner}@${env} $${file}`
        );
    } catch (error) {
      console.error(error.message);
    }
  };

  return gulp
    .src(src, { base: "./" })
    .pipe(map(processFile))
    .pipe(gulp.dest("."));
  // .on('end', () => ((!quiet) && console.log('Done.')))
};

const printResults = resp => {
  // Print column names and rows data
  let rows = resp.result.rows;
  if (rows) {
    // Replace null values with '(null)'
    rows = rows.map(r => r.map(v => v || "(null)"));
    const table = new Table({
      head: resp.result.metaData.map(col => col.name),
      style: { head: ["cyan"] }
    });
    table.push(...rows);
    console.log(table.toString());
  }
  // Print affected rows
  if (resp.result.rowsAffected) {
    console.log(
      // chalk.magenta(
      `${resp.result.rowsAffected} ${
        resp.result.rowsAffected === 1 ? "row" : "rows"
      } affected.`
      // )
    );
  }
  // Print dbms output
  if (resp.lines && resp.lines.length !== 0) {
    console.log(chalk.blue(resp.lines.join("\n")));
  }

  // Generate status msg
  const status = resp.errors.hasErrors()
    ? chalk.bgRed("Failure")
    : chalk.green("Success");
  console.log(`${status} => ${resp.obj.owner}@${resp.env} $${resp.file}`);
  // Concat errors to problem matcher format
  const errMsg = resp.errors.toString();
  if (errMsg) console.log(`${errMsg}`);
};

const getOnlyChangedFiles = async () => {
  const stdout = await git.getChangesNotStaged();
  // Get array of changed files from git
  const changed = base.fromStdoutToFilesArray(stdout);
  // Get array of files matched by glob pattern source array
  const all = base.fromGlobsToFilesArray(config.get("source"));
  // Intersection of both arrays
  const inter = _.intersection(all)(changed);
  return inter;
};

const compileFilesToDb = async ({
  file = argv.file,
  env = argv.env,
  changed = argv.changed,
  force = argv.force
}) => {
  const src =
    file || (changed ? await getOnlyChangedFiles() : config.get("source"));

  const processFile = async (file, done) => {
    let resp;
    try {
      // Compile file and get errors
      resp = await base.compileFile(file.contents, file.path, env, force);
      printResults(resp);
      // Stage file if no errors
      if (!force && !resp.errors.hasErrors()) {
        await git.exec({ args: `add "${resp.file}"` });
      }
    } catch (error) {
      console.error(error.message);
    } finally {
      // Return compiled resp object
      done(null, resp);
    }
  };

  // gulp4 rejects empty src
  src.length === 0 && src.push("nonvalidfile");

  return (
    gulp
      .src(src, { allowEmpty: true })
      // Compile file and emmit response
      .pipe(data(processFile))
      // End stream as there is no destination
      .on("data", gutil.noop)
    // .on('end', () => console.log('Done.'));
  );
};

const saveLogFile = ({ env = argv.env }) => {
  const deployDir = path.dirname(config.get("package.output"));
  const addEnvToName = path => {
    path.basename = path.basename + env;
  };
  return gulp
    .src(["./deploy.log"])
    .pipe(rename(addEnvToName))
    .pipe(gulp.dest(deployDir));
};

const runFileOnDb = async ({ file = argv.file, env = argv.env }) => {
  const src = file || config.get("package.output");

  // Simple output err colorizer
  const colorize = text =>
    _.pipe(
      // Remove double new-lines
      _.replace(/(\n\r)+/g, "\n"),
      _.trim,
      // Color red to the line that contains ERROR
      _.replace(/^.*ERROR.*$/gm, chalk.red("$&"))
    )(text);

  try {
    const stdout = await base.runFileAsScript(src, env);
    console.log(`${env}@${src}`);
    console.log(colorize(stdout));
  } catch (error) {
    console.error(`${error.message}`);
  }
};

const createDbConfigFile = async done => {
  if (!fs.existsSync("./dbconfig.json")) {
    fs.copySync(
      path.join(__dirname, "/config/templates/dbconfig.json"),
      "./dbconfig.json"
    );
    await inquirer.prompt([
      {
        type: "input",
        name: "defaultDbConfig",
        message: `Zdravo! Please edit DB configuration (dbconfig.json). Then press <enter> to continue.`
      }
    ]);
  }
  done();
};

const createProjectFiles = () => {
  // Create scripts dir for every user
  // and copy scripts templates
  db.loadDbConfig();
  const scriptsDirs = db.getUsers().map(v => `./scripts/${v}`);
  gulp
    .src([
      path.join(__dirname, "/config/templates/scripts/initial*.sql"),
      path.join(__dirname, "/config/templates/scripts/final*.sql")
    ])
    .pipe(multiDest(scriptsDirs));

  let src = [];

  if (!fs.existsSync("./.gitignore"))
    src.push(path.join(__dirname, "/config/templates/.gitignore"));
  if (!fs.existsSync("./test"))
    src.push(path.join(__dirname, "/config/templates/test/*.test.sql"));

  src.length === 0 && src.push("nonvalidfile");
  return gulp
    .src(src, {
      allowEmpty: true,
      base: path.join(__dirname, "/config/templates/")
    })
    .pipe(gulp.dest("."));
};

const cleanProject = () => {
  // Delete temp directories
  return del([
    "./scripts/*",
    "./deploy/*",
    "./**/*.log",
    "./**/changelog.md"
  ]).then(rDel => {
    rDel.length != 0 && console.log(chalk.magenta("Workspace cleaned."));
  });
};

const initGit = async () => {
  let isInitialized;
  try {
    isInitialized = await git.exec({
      args: "rev-parse --is-inside-work-tree"
    });
  } catch (error) {
    isInitialized = false;
  }

  if (!isInitialized) {
    //   let answer = await inquirer.prompt({
    //     type: "confirm",
    //     name: "branch",
    //     message: `Create new version branch?`
    //   });
    //   if (answer.branch) {
    //     await git.branch(`version-${config.get("version.number")}`);
    //     console.log(chalk.magenta("Branch created."));
    //   }
    // } else {
    let answer = await inquirer.prompt({
      type: "confirm",
      name: "repo",
      message: `Initialize git repository?`,
      default: true
    });
    if (answer.repo) {
      await git.exec({ args: "init" });
      console.log(chalk.magenta("Repository initialized."));
    }
  }
};

const initConfigFile = async () => {
  console.log("Let's fill out version details... Press <enter> to skip.");
  let res = await inquirer.prompt([
    {
      type: "input",
      name: "number",
      message: "Version number [major.minor.patch]?"
    },
    {
      type: "input",
      name: "description",
      message: "Version description?"
    },
    {
      type: "input",
      name: "releaseDate",
      message: "Version release date [YYYY-MM-DD]?"
    }
    // ,
    // {
    //   type: "input",
    //   name: "encoding",
    //   message: "Package encoding? (utf8)"
    // },
    // {
    //   type: "list",
    //   name: "warnings",
    //   message: "Compiler warning scope?",
    //   choices: ["NONE", "ALL", "PERFORMANCE", "INFORMATIONAL", "SEVERE"]
    // }
  ]);
  // Reload config obj
  config.load();
  // Save prompts to config file, leave defaults if empty
  // res.number && config.set("version.number", res.number);
  // res.description && config.set("version.description", res.description);
  // res.releaseDate && config.set("version.releaseDate", res.releaseDate);
  config.set("version.number", res.number || config.get("version.number"));
  config.set(
    "version.description",
    res.description || config.get("version.description")
  );
  config.set(
    "version.releaseDate",
    res.releaseDate || config.get("version.releaseDate")
  );

  // config.set(
  //   "package.encoding",
  //   res.encoding || config.get("package.encoding")
  // );
  // config.set(
  //   "compile.warnings",
  //   res.warnings || config.get("compile.warnings")
  // );
  console.log(chalk.green("Configuration file updated."));
};

const compileEverywhere = async ({ file = argv.file }) => {
  if (!file) throw Error("File cannot be empty.");
  // Compile to DEV
  const results = await compileFilesToDbAsync({ file, env: "DEV" });
  // If no errors deploy
  if (!results.some(file => file.errors.hasErrors())) {
    await compileFilesToDbAsync({ file, env: "TEST", force: true });
    await compileFilesToDbAsync({ file, env: "UAT", force: true });
  }
};

compileEverywhere.description = "Compile file to all environments.";
compileEverywhere.flags = {
  "--file": "Absolute path of file"
};
gulp.task("compileEverywhere", compileEverywhere);

gulp.task("compileEverywhereOnSave", function() {
  console.log(chalk.magenta("Compile-insync mode is running."));
  // Watch for files changes in source dir
  gulp.watch(config.get("source"), event => {
    // Watching task begins pattern for problem matching
    console.log(`\nFile ${event.type}. Starting compilation...`);
    // Compile and deploy file
    compileEverywhere({ file: event.path }).then(() =>
      console.log("Compilation complete.")
    );
  });
});

const createSrcEmpty = done => {
  try {
    const source = globBase(config.get("source")[0]).base;
    const users = db.getUsers();
    const dirs = utils.getDirTypes();
    for (const user of users) {
      for (const dir of dirs) {
        fs.ensureDirSync(`./${source}/${user}/${dir}`);
      }
    }
    done();
    // console.log(chalk.green("Src empty structure created."));
  } catch (err) {
    console.error(err);
  }
};

const createSrcFromDbObjects = async ({ env = argv.env }) => {
  // TODO source is array, taking first element
  const source = globBase(config.get("source")[0]).base;
  const users = db.getUsers();
  const objectTypes = utils.getObjectTypes();
  try {
    for (const owner of users) {
      const objs = await base.getObjectsInfoByType(env, owner, objectTypes);
      for (const obj of objs) {
        const type = utils.getDirFromObjectType(obj.OBJECT_TYPE);
        // Create empty sql file
        fs.outputFileSync(
          `./${source}/${owner}/${type}/${obj.OBJECT_NAME}.sql`,
          ""
        );
      }
    }
  } catch (error) {
    console.error(error.message);
  }
};

const exportFilesFromDbAsync = async ({ file, env, changed, ease, quiet }) =>
  new Promise(async (res, rej) => {
    const p = await exportFilesFromDb({ file, env, changed, ease, quiet });
    p.on("end", res);
    p.on("error", rej);
  });

const compileFilesToDbAsync = async ({ file, env, changed, force }) => {
  let results = [];
  return new Promise(async (res, rej) => {
    const p = await compileFilesToDb({ file, env, changed, force });
    // Collect results
    p.on("data", resp => results.push(resp.data));
    // Return results
    p.on("end", () => res(results));
    p.on("error", rej);
  });
};

const mergeLocalAndDbChanges = async ({
  file = argv.file,
  env = argv.env,
  changed = argv.changed
}) => {
  const src =
    file || (changed ? await getOnlyChangedFiles() : config.get("source"));

  if (src.length !== 0) {
    try {
      await git.stash();
      await exportFilesFromDbAsync({ file: src, env, quiet: true });
      await git.unstash();
    } catch (error) {
      // Git throws error when changes need merging
      // console.log(error);
    }
  }
};

const compileAndMergeFilesToDb = async ({
  file = argv.file,
  env = argv.env,
  changed = argv.changed,
  force = argv.force
}) => {
  force = force || config.get("compile.force");
  try {
    // Compile and get error results
    const results = await compileFilesToDbAsync({ file, env, changed, force });
    // Merge unstaged (if any dirty file)
    if (results.some(file => file.errors && file.errors.hasDirt()))
      mergeLocalAndDbChanges({ file, env, changed });
    // Update todo.md
    // extractTodos();
  } catch (error) {
    throw error;
  }
};

const extractTodos = () => {
  const src = config.get("source");

  return gulp
    .src(src, { base: "./" })
    .pipe(todo())
    .pipe(todo.reporter("vscode"))
    .pipe(gulp.dest("./"));
  // .on('end', () => console.log('Todos created.'))
};

const runTest = () => {
  return compileFilesToDbAsync({ file: config.get("test.input"), env: "DEV" });
};

const exportObjectFromDb = async ({ env = argv.env, object = argv.object }) => {
  try {
    const source = globBase(config.get("source")[0]).base;
    const objs = await base.resolveObjectInfo(env, { name: object });

    // Create array of abs file paths
    let files = objs.map(obj => {
      const owner = obj.OWNER;
      const type = utils.getDirFromObjectType(obj.OBJECT_TYPE);
      const name = obj.OBJECT_NAME;
      const relativePath = `./${source}/${owner}/${type}/${name}.sql`;
      return path.resolve(relativePath);
    });

    // Import files
    files.forEach(file => fs.outputFileSync(file, ""));
    await exportFilesFromDbAsync({ file: files, env, quiet: false });
  } catch (err) {
    console.error(err.message);
  }
};

const compileObjectToDb = async ({
  file = argv.file,
  env = argv.env,
  object = argv.object,
  line = argv.line
}) => {
  // console.log(object);
  let resp = await base.compileSelection(object, file, env, line);
  printResults(resp);
};

const generate = async ({
  env = argv.env,
  func = argv.func,
  file = argv.file,
  object = argv.object,
  output = argv.output
}) => {
  try {
    const resp = await base.getGenerator({ func, file, env, object });
    const outputPath = output
      ? path.resolve(output)
      : path.resolve(
          `./scripts/${resp.obj.owner}/file_${new Date().getTime()}.sql`
        );

    await utils.outputFilePromise(outputPath, resp.result);
    console.log(`${outputPath} ${chalk.green("created.")}`);
  } catch (err) {
    console.error(err.message);
  }
};

gulp.task(
  "initProject",
  gulp.series(
    createDbConfigFile,
    cleanProject,
    createProjectFiles,
    createSrcEmpty,
    initConfigFile,
    initGit
  )
);

gulp.task(
  "createProject",
  gulp.series(createSrcFromDbObjects, exportFilesFromDbAsync)
);

compileFilesToDbAsync.description = "Compile files to DB.";
compileFilesToDbAsync.flags = {
  "--env": "DB Environment. [DEV, TEST, UAT]",
  "--file": "(optional) Absolute path of file",
  "--changed": "(optional) Only changed files (in working tree)",
  "--force": "(optional) Overwrite DB changes"
};
gulp.task("compileFilesToDbAsync", compileFilesToDbAsync);

compileAndMergeFilesToDb.description = "Compile with merge.";
gulp.task("compileAndMergeFilesToDb", compileAndMergeFilesToDb);

gulp.task("compileObjectToDb", compileObjectToDb);

exportFilesFromDb.description = "Export files from DB.";
exportFilesFromDb.flags = {
  "--env": "DB Environment. [DEV, TEST, UAT]",
  "--file": "(optional) Absolute path of file",
  "--changed": "(optional) Only changed files (in working tree)",
  "--ease": "(optional) Export only if DB object changed",
  "--quiet": "(optional) Suppress console output"
};
gulp.task("exportFilesFromDb", exportFilesFromDbAsync);

gulp.task("exportObjectFromDb", exportObjectFromDb);

gulp.task(
  "packageSrc",
  gulp.series(packageSrcFromFile, makeChangeLog, extractTodos)
);

gulp.task(
  "createDeployInputFromGit",
  // gulp.series(createDeployInputFromGit, "packageSrc")
  createDeployInputFromGit
);

runFileOnDb.description = "Run file on DB with SqlPlus.";
runFileOnDb.flags = {
  "--env": "DB Environment. [DEV, TEST, UAT]",
  "--file": "(optional) Absolute path of file"
};
gulp.task("runFileOnDb", runFileOnDb);

runTest.description = "Simple unit testing.";
gulp.task("runTest", runTest);

// gulp.task("default", "packageSrc");

gulp.task("generate", generate);
