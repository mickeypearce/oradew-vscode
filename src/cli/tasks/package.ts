import * as path from "path";
import { pipe, map, mapValues, groupBy, clone, isEqual, uniq } from "lodash/fp";

import * as template from "gulp-template";
import * as map2 from "vinyl-map2";
import * as concat from "gulp-group-concat";
import * as noop from "gulp-noop";
import * as todo from "gulp-todo";
import { argv } from "yargs";
const gulp = require("gulp");
import * as convertEncoding from "gulp-convert-encoding";
import chalk from "chalk";

import { getObjectInfoFromPath, getPackageOutputPath } from "../common/dbobject";
import { getLogFilename, rootPrepend, rootRemove } from "../common/utility";
import { workspaceConfig as config } from "../common/config";
import { fromGlobsToFilesArray, fromStdoutToFilesArray, getGlobMatches } from "../common/globs";
import {
  getFirstCommitOnBranch,
  getCommitedFilesSincePoint,
  getCommitedFilesByCommits,
} from "../common/git";

const timestampHeader = `-- File created: ${new Date()} with Oradew for VS Code`;

const wrapDBObject = (code, file, done) => {
  const obj = getObjectInfoFromPath(file);

  const header = `
PROMPT ***********************************************************
PROMPT ${obj.owner}: {${obj.objectType}} ${obj.objectName}
PROMPT ***********************************************************
`;

  // Append slash char (/) to execute block in sqlplus to Source files
  const ending = obj.isSource ? "\n/" : "";

  done(null, header + code + ending);
};

const packageSrcFromFile = ({ env = argv.env }) => {
  const input = config.get({ field: "package.input", env });
  const pckEncoding = config.get({ field: "package.encoding", env });
  const templating = config.get({ field: "package.templating", env });
  const version = config.get({ field: "version.number", env });
  const srcEncoding = config.get({ field: "source.encoding", env });
  const exclude = config.get({ field: "package.exclude", env });

  const templateObject = {
    config: config.get({ env }),
    data: {
      // Dates in format YYYY-MM-DD
      now: new Date().toISOString().substring(0, 10),
    },
  };

  const wrapScript = (code, file, done) => {
    const obj = getObjectInfoFromPath(file);
    const outputPath = getPackageOutputPath(obj);
    const outputFileName = path.basename(outputPath);

    // Log is spooled to "package.output" filename with prefix and .log extension
    // spool__Run.sql.log by default
    const deployPrepend = `${timestampHeader}
SPOOL ${getLogFilename(outputFileName)}
SET FEEDBACK ON
SET ECHO OFF
SET VERIFY OFF
SET DEFINE OFF
PROMPT INFO: Deploying version ${version} ...
`;
    const deployAppend = `
COMMIT;
SPOOL OFF
`;
    done(null, deployPrepend + code + deployAppend);
  };

  console.log(
    `Packaging version ${version}...
Bundling files from "package.input": ${input} to deployment scripts:`
  );

  // --Warn If src encoding is changed but package encoding default...
  if (srcEncoding !== pckEncoding && pckEncoding === "utf8") {
    console.warn(
      `${chalk.yellow(
        "WARN"
      )} source.encoding (${srcEncoding}) is different than package.encoding (${pckEncoding})`
    );
  }

  // Output path is based on file info..
  // "package.output": "./deploy/{schema-name}/run.sql" for example

  // First convert globs to actual file paths
  const inputFiles = fromGlobsToFilesArray(input, {
    ignore: exclude,
  });

  // Then map to objects array of "input" file path and "output" file path
  // {
  //   input: './src/SCHEMA1/PACKAGE_BODIES/PCK_1.sql',
  //   output: './deploy/SCHEMA1/run.sql'
  // }, ....
  const mapFileToOutput = inputFiles.map((path) => {
    const obj = getObjectInfoFromPath(path);
    const outputPath = getPackageOutputPath(obj);
    return {
      input: path,
      output: outputPath,
    };
  });

  // gulp-group-concat input should look like this:
  // let outputMapping = {
  //   './deploy/SCHEMA1/run.sql': ['src/SCHEMA1/PACKAGE_BODIES/PCK_1.sql'],
  //   './deploy/SCHEMA2/run.sql': ['src/SCHEMA2/PACKAGES/PCK_1.sql', 'src/SCHEMA2/PACKAGE_BODIES/PCK_2.sql']
  // };
  // removeRoot as plugin doesn't work with ./'s
  let outputMapping = pipe(
    groupBy("output"),
    mapValues(pipe(map("input"), map(rootRemove)))
  )(mapFileToOutput);

  return (
    gulp
      .src(inputFiles, { allowEmpty: true })
      // First convert to utf8, run through the pipes and back to desired encoding
      .pipe(convertEncoding({ from: srcEncoding }))
      // Replace template variables, ex. config["config.variable"]
      .pipe(templating ? template(templateObject) : noop())
      // Adds object header and ending to every file
      .pipe(map2(wrapDBObject))
      // Concat files to one or more output files
      .pipe(concat(outputMapping))
      // Wrap every script with header and ending
      .pipe(map2(wrapScript))
      // Convert to desired encoding
      .pipe(convertEncoding({ to: pckEncoding }))
      .pipe(gulp.dest("."))
      .on("end", () =>
        console.log(
          `${Object.keys(outputMapping)
            .map((val) => `${val} ${chalk.green("packaged!")}`)
            .join("\n")}`
        )
      )
  );
};

const createDeployInputFromGit = async ({
  env = argv.env,
  from = argv.from,
  commit = argv.commit,
  append = argv.append,
}) => {
  try {
    console.log("Retrieving changed paths from git history...");
    // Get changed file paths from git history
    let stdout;
    if (commit) {
      // Convert to array as parameters can be arrays (--commit a --commit b)
      let commits = [].concat(commit);
      console.log(`From commit(s): ${commits}`);
      stdout = await getCommitedFilesByCommits(commits);
    } else {
      let firstCommit = from || ((await getFirstCommitOnBranch()) as string).trim();
      console.log(`Starting from commit: ${firstCommit} up to the head.`);
      stdout = await getCommitedFilesSincePoint(firstCommit);
    }

    const changedPaths = fromStdoutToFilesArray(stdout);

    // Exclude files that are not generally icluded
    const allSqlFiles = ["./**/*.sql"];
    const all = getGlobMatches(allSqlFiles, changedPaths);
    // Exclude excludes by config
    let excludeGlobs = config.get({ field: "package.exclude", env });
    const newInput = fromGlobsToFilesArray(all, {
      ignore: excludeGlobs,
    }).sort();

    if (newInput.length === 0) {
      console.log(`No changed files found or no tagged commit to start from.`);
      return;
    }

    // Get saved package input from config file
    let savedInput = clone(config.get("package.input") || []).sort();

    const inputToSave = append ? uniq(savedInput.concat(newInput)).sort() : newInput;

    if (isEqual(savedInput, inputToSave)) {
      console.log(`No new file paths added to package input.`);
      return;
    }

    // Save new input to config
    config.set("package.input", inputToSave);

    console.log(
      `${newInput.join("\n")} \n./oradewrc.json ${chalk.magenta("package.input updated.")}`
    );
  } catch (error) {
    console.error(error.message);
    console.error("Probably no commits or tags. Create some.");
  }
};

const generateBOLContent = function (paths) {
  // Create Db objects from paths array
  let dbo = paths.map((path) => {
    let obj = getObjectInfoFromPath(path);
    let exclude = path.startsWith("!");
    // return {...obj, exclude};
    return Object.assign({}, obj, { exclude });
  });

  // Group to structure:
  // { "owner": { "objectType": [ 'objectName' ] }}
  let o = pipe(
    groupBy("owner"),
    mapValues(pipe(groupBy("objectType"), mapValues(map("objectName"))))
  )(dbo);

  // Build markdown
  let c = "";
  for (let owner in o) {
    c = `${c}### ${owner}\n`;
    for (let i_objectType in o[owner]) {
      let objectType = o[owner][i_objectType];
      c = `${c}#### ${i_objectType}\n`;
      objectType.forEach((val) => {
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
  const all = fromGlobsToFilesArray(input, {
    ignore: excludeGlobs,
  });

  const content = generateBOLContent(all); // await git.getChangeLog();
  const templateObject = {
    config: config.get({ env }),
    data: {
      // Dates in format YYYY-MM-DD
      now: new Date().toISOString().substring(0, 10),
    },
  };
  const outputFile = config.get({ field: "package.output", env });
  // OutputFile can contain {schema-user} varibable...
  // Get first level directory for now
  const outputDirectory = rootPrepend(path.dirname(outputFile).split(path.posix.sep)[1]);

  // Add content to template object
  templateObject.data["content"] = content;
  return (
    gulp
      .src(file)
      .pipe(template(templateObject))
      // Prepend timestamp header
      .pipe(
        map2((code, file, done) => {
          done(null, `<!---\n${timestampHeader}\n-->\n` + code);
        })
      )
      .pipe(gulp.dest(outputDirectory))
      .on("end", () => console.log(`${outputDirectory}/BOL.md created`))
  );
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

export const packageTask = async ({
  delta = argv.delta,
  from = argv.from,
  commit = argv.commit,
  append = argv.append,
}) => {
  // If delta or from or commit, first populate package input
  let tasks = [
    ...[delta || from || commit ? createDeployInputFromGit : []],
    packageSrcFromFile,
    extractTodos,
    makeBillOfLading,
    // (done) => { console.log(chalk.green("done.")); done(); }
  ];
  return gulp.series(...tasks)();
};
