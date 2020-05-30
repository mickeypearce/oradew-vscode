

import { outputFileSync } from "fs-extra";
// import * as gulp from "gulp";
const gulp = require("gulp");
import { argv } from "yargs";

import { getObjectsInfoByType } from "../common/base";
import { getPathFromObjectInfo, getObjectTypes } from "../common/dbobject";
import { isGlobMatch } from "../common/globs";
import { exportFilesFromDbAsync } from "./import";
import { workspaceConfig as config } from "../common/config";
import { dbConfig } from "../common/config";


/*
 * Merge task (-t) from branch (-b) to current branch.
 * Usage ex. -t XXXX-5123 -b version-5.1.0
 **/
// const cherryPickFromJiraTask = async () => {
//   const branch = argv.b || "develop";
//   const task = argv.t;
//   if (task == null) { throw Error("Task cannot be empty. ex. -t XXXX-1234"); }

//   const stdout = await git.cherryPickByGrepAndBranch(task, branch);
//   console.log(`Files changed: ${stdout}`);
// };


const createSrcFromDbObjects = async ({
  env = argv.env || "DEV",
  file = argv.file
}) => {
  const source = file || config.get({ field: "source.input", env });
  const schemas = dbConfig.getSchemas();
  const objectTypes = getObjectTypes();
  try {
    for (const owner of schemas) {
      const objs = await getObjectsInfoByType(env, owner, objectTypes);
      for (const obj of objs) {
        const path = getPathFromObjectInfo(
          owner,
          obj.OBJECT_TYPE,
          obj.OBJECT_NAME
        );
        if (path !== "") {
          // is path inside "source" glob?
          if (isGlobMatch(source, [path])) {
            outputFileSync(path, "");
            console.log("Created file " + path);
          }
        }
      }
    }
  } catch (error) {
    console.error(error.message);
  }
};


export function createTask() {
  return gulp.series(createSrcFromDbObjects, exportFilesFromDbAsync);
}



