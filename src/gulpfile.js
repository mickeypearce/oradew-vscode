const path = require("path");
const fs = require("fs-extra");
const gulp = require("gulp");
const noop = require("gulp-noop");
const concat = require("gulp-concat");
const insert = require("gulp-insert");
const argv = require("yargs").argv;
const map = require("vinyl-map2");
const del = require("del");
const _ = require("lodash/fp");
const convertEncoding = require("gulp-convert-encoding");
const data = require("gulp-data");
const todo = require("gulp-todo");
const template = require("gulp-template");
const chalk = require("chalk");
const inquirer = require("inquirer");
const multiDest = require("gulp-multi-dest");
const Table = require("cli-table");

const utils = require("./common/utility");
const git = require("./common/git");
const base = require("./common/base");
const db = require("./common/db");
import {
  getObjectInfoFromPath,
  getPathFromObjectInfo,
  getStructure,
  replaceVarsInPattern,
  getObjectTypes
} from "./common/dbobject";

let config = utils.workspaceConfig;

const timestampHeader = `-- File created: ${new Date()} with Oradew for VS Code
`;

const addDBObjectPrompt = (code, file, done) => {
  const obj = getObjectInfoFromPath(file);

  const prompt = `
PROMPT ***********************************************************
PROMPT ${obj.owner}: {${obj.objectType}} ${obj.objectName}
PROMPT ***********************************************************
`;

  // Append slash char (/) to execute block in sqlplus to Source files
  const ending = obj.isSource ? "\n/" : "";

  done(null, prompt + code + ending);
};

const getLogFilename = filename => `spool__${filename}.log`;

const packageSrcFromFile = ({ env = argv.env }) => {
  const outputFile = config.get({ field: "package.output", env });
  const outputFileName = path.basename(outputFile);
  const outputDirectory = path.dirname(outputFile);
  const input = config.get({ field: "package.input", env });
  const pckEncoding = config.get({ field: "package.encoding", env });
  const templating = config.get({ field: "package.templating", env });
  const version = config.get({ field: "version.number", env });
  const srcEncoding = config.get({ field: "source.encoding", env });

  let exclude = config.get({ field: "package.exclude", env });
  exclude = exclude.map(utils.prependCheck("!"));

  const src = [...input, ...exclude];

  const templateObject = {
    config: config.get({ env }),
    data: {
      // Dates in format YYYY-MM-DD
      now: new Date().toISOString().substring(0, 10)
    }
  };

  // Log is spooled to "package.output" filename with prefix and .log extension
  // spool__Run.sql.log by default
  const deployPrepend = `
SPOOL ${getLogFilename(outputFileName)}
SET FEEDBACK ON
SET ECHO OFF
SET VERIFY OFF
SET DEFINE OFF
`;
  const deployAppend = `
COMMIT;
SPOOL OFF
`;

  const deployVersionPrepend = `
PROMPT INFO: Deploying version ${version} ...
`;

  // --Warn If src encoding is changed but package encoding default...
  if (srcEncoding !== pckEncoding && pckEncoding === "utf8") {
    console.warn(
      `${chalk.yellow(
        "WARN"
      )} source.encoding (${srcEncoding}) is different than package.encoding (${pckEncoding})`
    );
  }

  return (
    gulp
      .src(src, { allowEmpty: true })
      // First convert to utf8, run through the pipes and back to desired encoding
      .pipe(convertEncoding({ from: srcEncoding }))
      // Replace template variables, ex. config["config.variable"]
      .pipe(templating ? template(templateObject) : noop())
      // Adds object prompt to every file
      .pipe(map(addDBObjectPrompt))
      .pipe(concat(outputFileName))
      .pipe(insert.prepend(deployVersionPrepend))
      .pipe(insert.wrap(deployPrepend, deployAppend))
      .pipe(insert.prepend(timestampHeader))
      .pipe(convertEncoding({ to: pckEncoding }))
      .pipe(gulp.dest(outputDirectory))
      .on("end", () =>
        console.log(
          `${outputDirectory}/${outputFileName} ${chalk.green(
            "Script packaged."
          )}`
        )
      )
  );
};

const createDeployInputFromGit = async ({ env = argv.env }) => {
  try {
    console.log("Retrieving changed paths from git history...");
    // Get changed file paths from git history
    let firstCommit = await git.getFirstCommitOnBranch();
    const stdout = await git.getCommitedFilesSincePoint(firstCommit.trim());
    const changedPaths = base.fromStdoutToFilesArray(stdout).sort();

    // Exclude files that are not generally icluded
    const includedFiles = ["./**/*.sql"];
    const all = base.getGlobMatches(includedFiles, changedPaths);

    // Exclude excludes by config
    let excludeGlobs = config.get({ field: "package.exclude", env });
    const newInput = base.fromGlobsToFilesArray(all, {
      ignore: excludeGlobs
    });

    if (newInput.length === 0) {
      console.log(`No changed files found or no tagged commit to start from.`);
      return;
    }

    // Get saved package input from config file
    let savedInput = _.clone(config.get("package.input") || []).sort();

    if (_.isEqual(savedInput, newInput)) {
      console.log(`No new file paths added to package input.`);
      return;
    }

    // Save new input to config
    config.set("package.input", newInput);
    console.log(
      `${newInput.join("\n")} \n./oradewrc.json ${chalk.magenta(
        "package.input updated."
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

const generateBOLContent = function(paths) {
  // Create Db objects from paths array
  let dbo = paths.map(path => {
    let obj = getObjectInfoFromPath(path);
    let exclude = path.startsWith("!");
    // return {...obj, exclude};
    return Object.assign({}, obj, { exclude });
  });

  // Group to structure:
  // { "owner": { "objectType": [ 'objectName' ] }}
  let o = _.pipe(
    _.groupBy("owner"),
    _.mapValues(
      _.pipe(_.groupBy("objectType"), _.mapValues(_.map("objectName")))
    )
  )(dbo);

  // Build markdown
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

const makeBillOfLading = ({ env = argv.env }) => {
  const file = path.join(__dirname, "/templates/BOL*.md");

  // Generate change log from deploy input array
  const input = config.get({ field: "package.input", env });
  const excludeGlobs = config.get({ field: "package.exclude", env });
  const all = base.fromGlobsToFilesArray(input, {
    ignore: excludeGlobs
  });

  const content = generateBOLContent(all); // await git.getChangeLog();
  const templateObject = {
    config: config.get({ env }),
    data: {
      // Dates in format YYYY-MM-DD
      now: new Date().toISOString().substring(0, 10)
    }
  };
  const outputFile = config.get({ field: "package.output", env });
  const outputDirectory = path.dirname(outputFile);
  // Add content to template object
  templateObject.data.content = content;
  return gulp
    .src(file)
    .pipe(template(templateObject))
    .pipe(insert.prepend("<!---\n" + timestampHeader + "-->\n"))
    .pipe(gulp.dest(outputDirectory))
    .on("end", () => console.log(`${outputDirectory}/BOL.md created`));
};

const exportFilesFromDb = async ({
  file = argv.file,
  env = argv.env || "DEV",
  changed = argv.changed || false,
  ease = argv.ease || false,
  quiet = argv.quiet || false
}) => {
  const source = config.get({ field: "source.input", env });
  const src = file || (changed ? await getOnlyChangedFiles(source) : source);
  const getFunctionName = config.get({
    field: "import.getDdlFunction",
    env
  });
  const encoding = config.get({ field: "source.encoding", env });

  const processFile = async (code, file, done) => {
    let res;
    try {
      res = await base.exportFile(code, file, env, ease, getFunctionName, done);
      if (!quiet && res.exported)
        console.log(
          `${chalk.green("Imported")} <= ${res.obj.owner}@${env} $${file}`
        );
    } catch (error) {
      console.error(error.message);
    }
  };

  // gulp4 rejects empty src
  src.length === 0 && src.push("nonvalidfile");

  return gulp
    .src(src, { base: "./", allowEmpty: true })
    .pipe(convertEncoding({ from: encoding })) //  convert first to utf8, as code is passed allong if not exported from db (--ease)
    .pipe(map(processFile))
    .pipe(convertEncoding({ to: encoding }))
    .pipe(gulp.dest("."));

  // .on('end', () => ((!quiet) && console.log('Done.')))
};

const printResults = resp => {
  // Print column names and rows data
  if (resp.result) {
    let rows = resp.result.rows;
    if (rows) {
      // Replace null values with '(null)'
      rows = rows.map(r => r.map(v => (v === null ? "(null)" : v)));
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

const getOnlyChangedFiles = async source => {
  // Get array of changed files from git
  const stdout = await git.getChangesNotStaged();
  const changed = base.fromStdoutToFilesArray(stdout);
  // Get array of files matched by source array parameter
  return base.getGlobMatches(source, changed);
};

const compileFilesToDb = async ({
  file = argv.file,
  env = argv.env || "DEV",
  changed = argv.changed || false
}) => {
  const source = config.get({ field: "source.input", env });
  const src = file || (changed ? await getOnlyChangedFiles(source) : source);
  const warnings = config.get({ field: "compile.warnings", env });
  const stageFile = config.get({ field: "compile.stageFile", env });
  const force = config.get({ field: "compile.force", env });
  const encoding = config.get({ field: "source.encoding", env });

  const processFile = async (file, done) => {
    let resp;
    try {
      // Compile file and get errors
      resp = await base.compileFile(
        file.contents,
        file.path,
        env,
        force,
        warnings
      );
      printResults(resp);
      // Stage file if no errors
      if (stageFile && !resp.errors.hasErrors()) {
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
      // Default encoding to: 'utf8'
      .pipe(convertEncoding({ from: encoding }))
      // Compile file and emmit response
      .pipe(data(processFile))
      // End stream as there is no destination
      .on("data", noop)

    // .on('end', () => console.log('Done.'));
  );
};

const runFileOnDb = async ({ file = argv.file, env = argv.env || "DEV" }) => {
  const src = file || config.get({ field: "package.output", env });

  const filePath = path.resolve(src);
  if (!fs.existsSync(filePath)) {
    console.log(`File does not exist: ${filePath}`);
    console.log(`Try "Package" command to create a deployment script.`);
    return;
  }

  const outputFileName = path.basename(filePath);
  const outputDirectory = path.dirname(filePath);

  // Default log file that packaged scripts spools to
  const logPath = path.join(outputDirectory, getLogFilename(outputFileName));

  // Append 'env' to the log's filename to differentiate beetwen logs
  const logPathEnv = path.join(
    outputDirectory,
    getLogFilename(`${outputFileName}-${env}`)
  );

  // Simple output err colorizer
  const sanitize = text =>
    _.pipe(
      // Remove carriage returns
      _.replace(/\r\n/g, "\n"),
      // Remove double new-lines
      _.replace(/(\n\r)+/g, "\n"),
      _.trim
      // Color red to the line that contains ERROR
      // _.replace(/^.*ERROR.*$/gm, chalk.red("$&")),
      // Color orange to the line that contains Warning
      // _.replace(/^.*Warning:.*$/gm, chalk.yellow("$&"))
    )(text);

  try {
    const { stdout, obj } = await base.runFileAsScript(filePath, env);

    const out = sanitize(stdout);
    const errors = db.parseForErrors(out);

    // Prints errors in problem matcher format (one error per line)
    printResults({ errors, obj, env, file: filePath });

    // Outputs stdout
    console.log(
      "=============================== STDOUT ==============================="
    );
    console.log(out);

    // Add env suffix to log file if it exists
    if (fs.existsSync(logPath)) {
      fs.renameSync(logPath, logPathEnv);
    }
  } catch (error) {
    console.error(`${error.message}`);
  }
};

const createDbConfigFile = async ({}) => {
  // Create db config file if it doesn't exists already...
  if (!fs.existsSync(db.config.fileBase)) {
    db.config.createFile();

    console.log(
      `This utility will walk you through creating a dbconfig.json file.
It only covers basic items for DB connection for one environment (DEV).
You can edit, add DB environments or users later.

Press ^C at any time to quit or enter to skip.`
    );

    let res = await inquirer.prompt([
      {
        type: "input",
        name: "connectString",
        message: "Connection string?"
      },
      {
        type: "input",
        name: "user",
        message: "Username?"
      },
      {
        type: "input",
        name: "password",
        message: "Password?"
      }
    ]);
    // Save prompts to config file, leave defaults if empty
    db.config.set(
      "DEV.connectString",
      res.connectString || db.config.get("DEV.connectString")
    );
    db.config.set(
      "DEV.users[0].user",
      res.user || db.config.get("DEV.users[0].user")
    );
    db.config.set(
      "DEV.users[0].password",
      res.password || db.config.get("DEV.users[0].password")
    );
    console.log(`${db.config.fileBase} updated.`);
  }
};

const createProjectFiles = () => {
  // Create scripts dir for every user
  // and copy scripts templates
  db.config.load();
  const schemas = db.config.getSchemas();
  const scriptsDirs = schemas.map(v => `./scripts/${v}`);
  gulp
    .src([
      path.join(__dirname, "/templates/scripts/initial*.sql"),
      path.join(__dirname, "/templates/scripts/final*.sql")
    ])
    .pipe(multiDest(scriptsDirs));

  // Array of test directoris with schema in path, if it don't already exists
  const testsDirs = schemas
    .filter(v => !fs.existsSync(`./test/${v}`))
    .map(v => `./test/${v}`);
  gulp
    .src([path.join(__dirname, "/templates/test/*.test.sql")])
    .pipe(multiDest(testsDirs));

  let src = [];
  if (!fs.existsSync("./.gitignore"))
    src.push(path.join(__dirname, "/templates/.gitignore"));

  src.length === 0 && src.push("nonvalidfile");
  return gulp
    .src(src, {
      allowEmpty: true,
      base: path.join(__dirname, "/templates/")
    })
    .pipe(gulp.dest("."))
    .on("end", () =>
      console.log(`workspace structure initialized for user(s): ${schemas}`)
    );
};

const cleanProject = () => {
  // Delete temp directories
  return del(["./scripts/*", "./deploy/*", "./**/*.log"]).then(rDel => {
    rDel.length != 0 && console.log("workspace cleaned.");
  });
};

const initGit = async ({}) => {
  let isInitialized;
  try {
    isInitialized = await git.exec({
      args: "rev-parse --is-inside-work-tree"
    });
  } catch (error) {
    isInitialized = false;
  }

  if (!isInitialized) {
    let answer = await inquirer.prompt({
      type: "confirm",
      name: "repo",
      message: `Initialize git repository?`,
      default: true
    });

    if (answer.repo) {
      await git.exec({ args: "init" });
      console.log("Repository initialized.");
    }
  }
};

const initConfigFile = async ({}) => {
  let answer = await inquirer.prompt({
    type: "confirm",
    name: "ws",
    message: `Do you want to edit oradewrc.json file?`,
    default: false
  });
  if (!answer.ws) return;
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
  ]);
  // Save prompts to config file, leave defaults if empty
  config.set("version.number", res.number || config.get("version.number"));
  config.set(
    "version.description",
    res.description || config.get("version.description")
  );
  config.set(
    "version.releaseDate",
    res.releaseDate || config.get("version.releaseDate")
  );
  console.log(`${config.getFileEnv()} updated.`);
};

// unused
const compileEverywhere = async ({ file, env }) => {
  if (!file) throw Error("File cannot be empty.");
  // Compile to env
  const results = await compileFilesToDbAsync({ file, env });
  // If no errors deploy
  if (!results.some(file => file.errors.hasErrors())) {
    await compileFilesToDbAsync({ file, env: "TEST" });
    await compileFilesToDbAsync({ file, env: "UAT" });
  }
};

const compileOnSave = ({ env = argv.env || "DEV" }) => {
  // Watch for files changes in source dir
  const source = config.get("source.input");
  const watcher = gulp.watch(source, { awaitWriteFinish: true });
  console.log(chalk.magenta(`Watching for file changes in ${source} ...`));
  watcher.on("change", async file => {
    // Print pattern for start problem matching
    console.log(`\nStarting compilation...`);
    // Compile changes in working tree
    const files = await getOnlyChangedFiles(source);
    await compileFilesToDbAsync({ env, file: files });
    // Always compile saved path (even if nothing changes)
    if (!utils.includesPaths(files, file))
      await compileFilesToDbAsync({ env, file });
    // Print pattern that ends problem matching
    console.log("Compilation complete.");
  });
};

const createSrcEmpty = done => {
  try {
    const schemas = db.config.getSchemas();
    const dirs = getStructure();
    for (const owner of schemas) {
      dirs.forEach(pattern => {
        const dirPath = replaceVarsInPattern(pattern, owner);
        return fs.ensureDirSync(dirPath);
      });
    }
    done();

    // console.log(chalk.green("Src empty structure created."));
  } catch (err) {
    console.error(err);
  }
};

const createSrcFromDbObjects = async ({
  env = argv.env || "DEV",
  file = argv.file
}) => {
  const source = file || config.get({ field: "source.input", env });
  const schemas = db.config.getSchemas();
  const objectTypes = getObjectTypes();
  try {
    for (const owner of schemas) {
      const objs = await base.getObjectsInfoByType(env, owner, objectTypes);
      for (const obj of objs) {
        const path = getPathFromObjectInfo(
          owner,
          obj.OBJECT_TYPE,
          obj.OBJECT_NAME
        );
        if (path !== "") {
          // is path inside "source" glob?
          if (base.isGlobMatch(source, [path])) {
            fs.outputFileSync(path, "");
            console.log("Created file " + path);
          }
        }
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

const compileFilesToDbAsync = async ({ file, env, changed }) => {
  let results = [];
  return new Promise(async (res, rej) => {
    const p = await compileFilesToDb({ file, env, changed });
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
  const source = config.get({ field: "source.input", env });
  const src = file || (changed ? await getOnlyChangedFiles(source) : source);

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
  env = argv.env || "DEV",
  changed = argv.changed || false
}) => {
  try {
    // Compile and get error results
    const results = await compileFilesToDbAsync({ file, env, changed });
    // Merge unstaged (if any dirty file)
    if (results.some(file => file.errors && file.errors.hasDirt()))
      mergeLocalAndDbChanges({ file, env, changed });

    // Update todo.md

    // extractTodos();
  } catch (error) {
    throw error;
  }
};

const extractTodos = ({ env = argv.env }) => {
  const src = config.get({ field: "source.input", env });

  return gulp
    .src(src, { base: "./" })
    .pipe(todo())
    .pipe(todo.reporter("vscode"))
    .pipe(gulp.dest("./"))
    .on("end", () => console.log("./TODO.md created"));
};

const runTest = ({ env = argv.env || "DEV" }) => {
  const input = config.get({ field: "test.input", env });
  return compileFilesToDbAsync({ file: input, env });
};

const exportObjectFromDb = async ({
  env = argv.env || "DEV",
  object = argv.object
}) => {
  try {
    if (!object) throw Error("Object cannot be empty.");

    const objs = await base.resolveObjectInfo(env, { name: object });

    // Create array of abs file paths
    let files = objs.map(obj => {
      const relativePath = getPathFromObjectInfo(
        obj.OWNER,
        obj.OBJECT_TYPE,
        obj.OBJECT_NAME
      );
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
  env = argv.env || "DEV",
  object = argv.object,
  line = argv.line
}) => {
  try {
    if (!object) throw Error("Object cannot be empty.");
    let resp = await base.compileSelection(object, file, env, line);
    printResults(resp);
  } catch (err) {
    console.error(err.message);
  }
};

const generate = async ({
  env = argv.env || "DEV",
  func = argv.func,
  file = argv.file,
  object = argv.object,
  output = argv.output
}) => {
  try {
    if (!func) throw Error("Func cannot be empty.");

    const resp = await base.getGenerator({ func, file, env, object });

    // Save to output argument if it exists
    // otherwise save to generated file in ./script directory
    const outputPath = output
      ? path.resolve(output)
      : path.resolve(
          `./scripts/${
            resp.obj.owner
          }/file_${object}_${new Date().getTime()}.sql`
        );

    await utils.outputFilePromise(outputPath, resp.result);
    console.log(`${outputPath} ${chalk.green("created.")}`);
  } catch (err) {
    console.error(err.message);
  }
};

gulp.task(
  "init",
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
  "create",
  gulp.series(createSrcFromDbObjects, exportFilesFromDbAsync)
);

compileFilesToDbAsync.description = "Compile files to DB.";
compileFilesToDbAsync.flags = {
  "--env": "DB Environment. [DEV, TEST, UAT]",
  "--file": "(optional) Absolute path of file",
  "--changed": "(optional) Only changed files (in working tree)"
};

compileAndMergeFilesToDb.description = "Compile with merge.";

gulp.task("compileOnSave", compileOnSave);
gulp.task("watch", compileOnSave);

exportFilesFromDb.description = "Export files from DB.";
exportFilesFromDb.flags = {
  "--env": "DB Environment. [DEV, TEST, UAT]",
  "--file": "(optional) Absolute path of file",
  "--changed": "(optional) Only changed files (in working tree)",
  "--ease": "(optional) Export only if DB object changed",
  "--quiet": "(optional) Suppress console output"
};

gulp.task("package", async ({ delta = argv.delta }) => {
  // If delta, first populate package input
  let tasks = [
    ...[delta ? createDeployInputFromGit : []],
    extractTodos,
    makeBillOfLading,
    packageSrcFromFile
  ];
  return gulp.series(...tasks)();
});

gulp.task(
  "createDeployInputFromGit",
  // gulp.series(createDeployInputFromGit, "package")
  createDeployInputFromGit
);

runFileOnDb.description = "Run file on DB with SqlPlus.";
runFileOnDb.flags = {
  "--env": "DB Environment. [DEV, TEST, UAT]",
  "--file": "(optional) Absolute path of file"
};
gulp.task("run", runFileOnDb);
gulp.task("deploy", runFileOnDb); // Alias

runTest.description = "Simple unit testing.";
gulp.task("test", runTest);

// gulp.task("default", "package");

gulp.task("generate", generate);

// Composed tasks - @todo refactor
gulp.task(
  "compile",
  ({
    env = argv.env || "DEV",
    file = argv.file,
    changed = argv.changed || false,
    object = argv.object,
    line = argv.line
  }) => {
    if (object) return compileObjectToDb({ file, env, object, line });
    else return compileAndMergeFilesToDb({ file, env, changed });
  }
);

gulp.task(
  "import",
  ({
    env = argv.env || "DEV",
    file = argv.file,
    changed = argv.changed || false,
    ease = argv.ease,
    quiet = argv.quiet || false,
    object = argv.object
  }) => {
    // ease is a string 'true' or 'false' in parameter
    let s_ease = ease || config.get({ field: "import.ease", env }).toString();
    let b_ease = (s_ease == 'true');
    if (object) return exportObjectFromDb({ env, object });
    else return exportFilesFromDbAsync({ file, env, changed, ease: b_ease, quiet });
  }
);
