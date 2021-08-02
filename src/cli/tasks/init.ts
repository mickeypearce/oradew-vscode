const gulp = require("gulp");
import { argv } from "yargs";
import * as inquirer from "inquirer";
import * as multiDest from "gulp-multi-dest";
import del from "del";
import * as fs from "fs-extra";
import * as path from "path";

import * as git from "../common/git";
import { workspaceConfig as config } from "../common/config";
import { getSourceStructure, replaceVarsInPattern } from "../common/dbobject";
import { dbConfig } from "../common/config";

const createSrcEmpty = (done) => {
  try {
    const schemas = dbConfig.getSchemas();
    const dirs = getSourceStructure();
    for (const owner of schemas) {
      dirs.forEach((pattern) => {
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

const createDbConfigFile = async ({}) => {
  // Create db config file if it doesn't exists already...
  if (!fs.existsSync(dbConfig.fileBase as string)) {
    dbConfig.createFile();

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
        message: "Connection string?",
      },
      {
        type: "input",
        name: "user",
        message: "Username?",
      },
      {
        type: "input",
        name: "password",
        message: "Password?",
      },
    ]);
    // Save prompts to config file, leave defaults if empty
    dbConfig.set("DEV.connectString", res.connectString || dbConfig.get("DEV.connectString"));
    dbConfig.set("DEV.users[0].user", res.user || dbConfig.get("DEV.users[0].user"));
    dbConfig.set("DEV.users[0].password", res.password || dbConfig.get("DEV.users[0].password"));
    console.log(`${dbConfig.fileBase} updated.`);
  }
};

const createProjectFiles = ({ env = argv.env || "DEV" }) => {
  // Create scripts dir for every user
  // and copy scripts templates
  dbConfig.load();
  const schemas = dbConfig.getSchemas(env as string);
  const scriptsDirs = schemas.map((v) => `./scripts/${v}`);
  gulp
    .src([
      path.join(__dirname, "/templates/scripts/initial*.sql"),
      path.join(__dirname, "/templates/scripts/final*.sql"),
    ])
    .pipe(multiDest(scriptsDirs));

  // Array of test directoris with schema in path, if it don't already exists
  const testsDirs = schemas.filter((v) => !fs.existsSync(`./test/${v}`)).map((v) => `./test/${v}`);

  gulp.src([path.join(__dirname, "/templates/test/*.test.sql")]).pipe(multiDest(testsDirs));

  let src = [];
  if (!fs.existsSync("./.gitignore")) {
    src.push(path.join(__dirname, "/templates/.gitignore"));
  }

  if (src.length === 0) {
    src.push("nonvalidfile");
  }
  return gulp
    .src(src, {
      allowEmpty: true,
      base: path.join(__dirname, "/templates/"),
    })
    .pipe(gulp.dest("."))
    .on("end", () => {
      if (schemas === null || schemas === undefined || schemas.length === 0) {
        console.error("Workspace could not be initialized, please check dbconfig.json file.");
        throw new Error("Workspace could not be initialized, please check dbconfig.json file.");
      } else {
        console.log(`Workspace structure initialized for user(s): ${schemas}`);
      }
    });
};

const cleanProject = () => {
  // Delete temp directories
  return del(["./scripts/*", "./deploy/*", "./**/*.log"]).then((rDel) => {
    if (rDel.length !== 0) {
      console.log("Workspace cleaned.");
    }
  });
};

const initGit = async ({}) => {
  let isInitialized;
  try {
    isInitialized = await git.exec({
      args: "rev-parse --is-inside-work-tree",
    });
  } catch (error) {
    isInitialized = false;
  }

  if (!isInitialized) {
    let answer = await inquirer.prompt({
      type: "confirm",
      name: "repo",
      message: `Initialize git repository?`,
      default: true,
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
    default: false,
  });
  if (!answer.ws) {
    return;
  }
  let res = await inquirer.prompt([
    {
      type: "input",
      name: "number",
      message: "Version number [major.minor.patch]?",
    },
    {
      type: "input",
      name: "description",
      message: "Version description?",
    },
    {
      type: "input",
      name: "releaseDate",
      message: "Version release date [YYYY-MM-DD]?",
    },
  ]);
  // Save prompts to config file, leave defaults if empty
  config.set("version.number", res.number || config.get("version.number"));
  config.set("version.description", res.description || config.get("version.description"));
  config.set("version.releaseDate", res.releaseDate || config.get("version.releaseDate"));
  console.log(`${config.getFileEnv()} updated.`);
};

export async function initTask() {
  return gulp.series(
    createDbConfigFile,
    cleanProject,
    createProjectFiles,
    createSrcEmpty,
    initConfigFile,
    initGit,
    (done) => {
      console.log("done!");
      done();
    }
  )();
}
