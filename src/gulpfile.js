const path = require("path");
const fs = require("fs-extra");
const gulp = require("gulp");
const gutil = require("gulp-util");
const concat = require("gulp-concat");
const insert = require("gulp-insert");
const rename = require("gulp-rename");
const argv = require("yargs").argv;
const runSequence = require("run-sequence");
const map = require("vinyl-map2");
const del = require("del");
const _ = require("lodash/fp");
const convertEncoding = require("gulp-convert-encoding");
const data = require("gulp-data");
const todo = require("gulp-todo");
const template = require("gulp-template");
const chalk = require("chalk");
const prompt = require("gulp-prompt");
const globBase = require("glob-base");
const merge = require("merge-stream");
const multiDest = require("gulp-multi-dest");

const utils = require("./config/utils/utility");
const git = require("./config/utils/git");
const base = require("./config/utils/base");
const db = require("./config/utils/db");

let config = base.config;

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

  const deployFile = path.win32.basename(config.get("package.output"));
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

  const templating = config.get("package.templating") || false;

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

packageSrcFromFile.description = "Package files to deploy script.";
packageSrcFromFile.flags = {};

gulp.task("packageSrcFromFile", packageSrcFromFile);

gulp.task("createDeployInputFromGit", async () => {
  // Supply a branch to include changes from with argument "-b <branch>"
  // "-b master" - For hotfix versions and "-b develop" - Standard versions (default)
  const initBranch = argv.b || "develop";

  const stdout = await git.getCommitedFilesSinceBranch(initBranch);
  // Create files array from stdout
  const deployInput = base.fromStdoutToFilesArray(stdout);

  // Assign files to config obj
  config.set("package.input", deployInput);
  // Save to config file
  config.save();
  console.log(`Files changed: ${deployInput}`);
});

/*
 * Merge task (-t) from branch (-b) to current branch.
 * Usage ex. -t XXXX-5123 -b version-5.1.0
 **/
gulp.task("cherryPickFromJiraTask", async () => {
  const branch = argv.b || "develop";
  const task = argv.t;
  if (task == null) throw Error("Task cannot be empty. ex. -t XXXX-1234");

  const stdout = await git.cherryPickByGrepAndBranch(task, branch);
  console.log(`Files changed: ${stdout}`);
});

gulp.task("makeChangeLog", () => {
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
});

gulp.task("packageSrc", function() {
  runSequence("packageSrcFromFile", "makeChangeLog", "todo");
});

gulp.task("packageFromChanges", function() {
  runSequence("createDeployInputFromGit", "packageSrc");
});

gulp.task("default", ["packageSrc"]);

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
        console.log(`${chalk.green("Imported")} <= ${env}@${file}`);
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

exportFilesFromDb.description = "Export files from DB.";
exportFilesFromDb.flags = {
  "--env": "DB Environment. [DEV, TEST, UAT]",
  "--file": "(optional) Absolute path of file",
  "--changed": "(optional) Only changed files (in working tree)",
  "--ease": "(optional) Export only if DB object changed",
  "--quiet": "(optional) Suppress console output"
};

gulp.task("exportFilesFromDb", exportFilesFromDb);

const printResults = resp => {
  // Print column names
  resp.result.metaData &&
    console.log(
      chalk.bgYellow(resp.result.metaData.map(col => col.name).join("\t"))
    );
  // Print rows data
  resp.result.rows &&
    console.log(resp.result.rows.map(row => row.join("\t")).join("\n"));
};

const printErrors = resp => {
  if (!resp.errors) return resp;
  // Concat errors to problem matcher format
  const errMsg = resp.errors.toString();
  // Generate status msg
  const status = resp.errors.hasErrors()
    ? chalk.bgRed("Failure")
    : chalk.green("Compiled");
  console.log(`${status} => ${resp.env}@${resp.file}`);
  if (errMsg) console.log(`${errMsg}`);
  return resp;
};

// Stage file if no errors
const addGit = async resp => {
  if (!resp.errors) return resp;
  if (!resp.errors.hasErrors()) {
    await git.exec({ args: `add ${resp.file}` });
  }
  return resp;
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

gulp.task("getOnlyChangedFiles", getOnlyChangedFiles);

const compileFilesToDb = async ({
  file = argv.file,
  env = argv.env,
  changed = argv.changed,
  force = argv.force
}) => {
  const src =
    file || (changed ? await getOnlyChangedFiles() : config.get("source"));

  const scope = config.get("compile.warnings");

  const processFile = async (file, done) => {
    let resp;
    try {
      // Compile file and get errors
      resp = await base.compileFile(
        file.contents,
        file.path,
        env,
        force,
        scope
      );
      // Print errors to output
      printErrors(resp);
      // Print query results if any
      printResults(resp);
      // Stage file if no errors
      if (!force) await addGit(resp);
    } catch (error) {
      console.error(error.message);
    } finally {
      // Return compiled resp object
      done(null, resp);
    }
  };

  return (
    gulp
      .src(src)
      // Compile file and emmit response
      .pipe(data(processFile))
      // End stream as there is no destination
      .on("data", gutil.noop)
    // .on('end', () => console.log('Done.'));
  );
};

compileFilesToDb.description = "Compile files to DB.";
compileFilesToDb.flags = {
  "--env": "DB Environment. [DEV, TEST, UAT]",
  "--file": "(optional) Absolute path of file",
  "--changed": "(optional) Only changed files (in working tree)",
  "--force": "(optional) Overwrite DB changes"
};

gulp.task("compileFilesToDb", compileFilesToDb);

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
gulp.task("saveLogFile", saveLogFile);

const deployFilesToDb = ({ file = argv.file, env = argv.env }) => {
  const src = file || config.get("package.output");

  // Simple output err colorizer
  const colorize = text =>
    _.pipe(
      // Remove double new-lines
      _.replace(/(\n\r)+/g, "\n"),
      _.trim,
      _.replace(/ERROR/g, chalk.red("ERROR"))
    )(text);

  const processFile = (error, stdout, stderr) => {
    if (error) throw error;
    console.log(`${env}@${src}`);
    console.log(colorize(stdout));
    console.log(`${stderr}`);
  };
  base.deployFile(src, env, processFile);
};

deployFilesToDb.description = "Deploy files to DB with SqlPlus.";
deployFilesToDb.flags = {
  "--env": "DB Environment. [DEV, TEST, UAT]",
  "--file": "(optional) Absolute path of file"
};

gulp.task("deployFilesToDb", deployFilesToDb);

const createProjectFiles = () => {
  // Create scripts dir for every user
  // Array of scripts dirs
  const scriptsDirs = db.getUsers().map(v => `./scripts/${v}`);
  gulp
    .src([
      path.join(__dirname, "/config/templates/scripts/initial*.sql"),
      path.join(__dirname, "/config/templates/scripts/final*.sql")
    ])
    .pipe(multiDest(scriptsDirs));

  // Copy from /templates with folder structure
  let src = [path.join(__dirname, "/config/templates/oradewrc.json")];

  // Dont-overwrite files
  //   .pipe(gulp.dest(".", { overwrite: false })); gulp@4.0.0
  if (!fs.existsSync("./dbconfig.json"))
    src.push(path.join(__dirname, "/config/templates/dbconfig.json"));
  if (!fs.existsSync("./.gitignore"))
    src.push(path.join(__dirname, "/config/templates/.gitignore"));
  if (!fs.existsSync("./test"))
    src.push(path.join(__dirname, "/config/templates/test/*.test.sql"));

  return gulp
    .src(src, { base: path.join(__dirname, "/config/templates/") })
    .pipe(gulp.dest("."))
    .on("end", () => {
      console.log(chalk.green("Project files created."));
    });
};
gulp.task("createProjectFiles", createProjectFiles);

const cleanProject = () => {
  // Delete temp directories
  let rDel = del.sync([
    ".\\scripts\\*",
    ".\\deploy\\*",
    ".\\**\\*.log",
    ".\\**\\changelog.md"
  ]);
  rDel.length != 0 && console.log(chalk.magenta("Project cleaned."));
  return rDel;
};
gulp.task("cleanProject", cleanProject);

const initGit = async () => {
  let isInitialized;
  try {
    isInitialized = await git.exec({
      args: "rev-parse --is-inside-work-tree"
    });
  } catch (error) {
    isInitialized = false;
  }

  if (isInitialized) {
    return gulp
      .src(config.file)
      .pipe(prompt.confirm(`Create new version branch?`))
      .on("data", () => git.branch(`version-${config.get("version.number")}`))
      .on("end", () => console.log(chalk.magenta("Branch created.")));
  } else {
    return gulp
      .src(config.file)
      .pipe(prompt.confirm(`Init git repo?`))
      .on("data", () => git.exec({ args: "init" }))
      .on("end", () => console.log(chalk.magenta("Repo initialized.")));
  }
};
gulp.task("initGit", initGit);

const initConfigFile = () => {
  // Copy config file template
  return gulp
    .src(config.file)
    .pipe(
      prompt.prompt(
        [
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
          },
          {
            type: "input",
            name: "encoding",
            message: "Package encoding? (utf8)"
          },
          {
            type: "list",
            name: "warnings",
            message: "Compiler warning scope?",
            choices: ["NONE", "ALL", "PERFORMANCE", "INFORMATIONAL", "SEVERE"]
          }
        ],
        res => {
          // Reload config obj
          config.load();
          // Save prompts to config file, leave defaults if empty
          config.set(
            "version.number",
            res.number || config.get("version.number")
          );
          config.set(
            "version.description",
            res.description || config.get("version.description")
          );
          config.set(
            "version.releaseDate",
            res.releaseDate || config.get("version.releaseDate")
          );
          config.set(
            "package.encoding",
            res.encoding || config.get("package.encoding")
          );
          config.set(
            "compile.warnings",
            res.warnings || config.get("compile.warnings")
          );
          config.save();
        }
      )
    )
    .on("data", () => console.log(chalk.green("Configuration file updated.")));
};
gulp.task("initConfigFile", initConfigFile);

gulp.task("initProject", function() {
  runSequence(
    "cleanProject",
    "createProjectFiles",
    "createSrcEmpty",
    "initConfigFile",
    "initGit"
  );
});

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

const createSrcEmpty = () => {
  try {
    const source = globBase(config.get("source")[0]).base;
    const users = db.getUsers();
    const dirs = utils.getDirTypes();
    for (const user of users) {
      for (const dir of dirs) {
        fs.ensureDirSync(`./${source}/${user}/${dir}`);
      }
    }
    // console.log(chalk.green("Src empty structure created."));
  } catch (err) {
    console.error(err);
  }
};

gulp.task("createSrcEmpty", createSrcEmpty);

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

createSrcFromDbObjects.description = "Create Src structure from Db Objects.";
createSrcFromDbObjects.flags = {
  "--env": "DB Environment. [DEV, TEST, UAT]"
};
gulp.task("createSrcFromDbObjects", createSrcFromDbObjects);

gulp.task("createProject", function() {
  runSequence("createSrcFromDbObjects", "exportFilesFromDb");
});

const exportFilesFromDbAsync = async ({ file, env, changed, quiet }) =>
  new Promise(async (res, rej) => {
    const p = await exportFilesFromDb({ file, env, changed, quiet });
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
gulp.task("mergeLocalAndDbChanges", mergeLocalAndDbChanges);

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

compileAndMergeFilesToDb.description = "Compile with merge.";
gulp.task("compileAndMergeFilesToDb", compileAndMergeFilesToDb);

const extractTodos = () => {
  const src = config.get("source");

  gulp
    .src(src, { base: "./" })
    .pipe(todo())
    .pipe(todo.reporter("vscode"))
    .pipe(gulp.dest("./"));
  // .on('end', () => console.log('Todos created.'))
};

extractTodos.description = "Todos extraction.";
gulp.task("todo", extractTodos);

const runTest = () => {
  compileFilesToDb({ file: config.get("test.input"), env: "DEV" });
};
runTest.description = "Simple unit testing.";
gulp.task("runTest", runTest);

const importObjectFromDb = async ({ env = argv.env, object = argv.object }) => {
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
gulp.task("importObjectFromDb", importObjectFromDb);
