import * as map2 from "vinyl-map2";
import { argv } from "yargs";
import * as gulp from "gulp";

import * as fs from "fs-extra";
import * as path from "path";
import chalk from "chalk";
import * as convertEncoding from "gulp-convert-encoding";

import { workspaceConfig as config } from "../common/config";
import { getOnlyChangedFiles } from "../common/globs";
import { exportFile, resolveObjectInfo } from "../common/base";
import { getPathFromObjectInfo } from "../common/dbobject";

export const exportFilesFromDbAsync = async ({
  file,
  env,
  changed = false,
  ease = false,
  quiet = false,
}) =>
  new Promise(async (res, rej) => {
    const p = await exportFilesFromDb({ file, env, changed, ease, quiet });
    p.on("end", res);
    p.on("error", rej);
  });

const exportFilesFromDb = async ({
  file = argv.file,
  env = argv.env || "DEV",
  changed = argv.changed || false,
  ease = argv.ease || false,
  quiet = argv.quiet || false,
}) => {
  const source = config.get({ field: "source.input", env });
  const src = file || (changed ? await getOnlyChangedFiles(source) : source);
  const getFunctionName = config.get({
    field: "import.getDdlFunction",
    env,
  });
  const encoding = config.get({ field: "source.encoding", env });

  const processFile = async (code, file, done) => {
    let res;
    try {
      res = await exportFile(code, file, env, ease, getFunctionName, done);
      if (!quiet && res.exported) {
        console.log(`${chalk.green("Imported")} <= ${res.obj.owner}@${env} $${file}`);
      }
    } catch (error) {
      console.error(error.message);
    }
  };

  // gulp4 rejects empty src
  if (src.length === 0) {
    src.push("nonvalidfile");
  }
  return gulp
    .src(src, { base: "./", allowEmpty: true })
    .pipe(convertEncoding({ from: encoding })) //  convert first to utf8, as code is passed allong if not exported from db (--ease)
    .pipe(map2(processFile))
    .pipe(convertEncoding({ to: encoding }))
    .pipe(gulp.dest("."));

  // .on('end', () => ((!quiet) && console.log('Done.')))
};

const exportObjectFromDb = async ({
  env = argv.env || "DEV",
  object = argv.object,
  user = argv.user,
  file = argv.file,
}) => {
  try {
    if (!object) {
      throw Error("Object cannot be empty.");
    }

    const objs = await resolveObjectInfo(env, object, user as string, file);

    // Create array of abs file paths
    let files = objs.map((obj) => {
      const relativePath = getPathFromObjectInfo(obj.OWNER, obj.OBJECT_TYPE, obj.OBJECT_NAME);
      return path.resolve(relativePath);
    });

    // Import files
    files.forEach((file) => fs.outputFileSync(file, ""));
    await exportFilesFromDbAsync({ file: files, env });
  } catch (err) {
    console.error(err.message);
  }
};

export function importTask({
  env = argv.env || "DEV",
  file = argv.file,
  changed = (argv.changed as boolean) || false,
  ease = argv.ease,
  quiet = (argv.quiet as boolean) || false,
  object = argv.object,
}) {
  // ease is a string 'true' or 'false' in parameter
  let s_ease = ease || config.get({ field: "import.ease", env }).toString();
  let b_ease = s_ease === "true";
  if (object) {
    return exportObjectFromDb({ env, object });
  } else {
    return exportFilesFromDbAsync({ file, env, changed, ease: b_ease, quiet });
  }
}
