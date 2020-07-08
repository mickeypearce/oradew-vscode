import { argv } from "yargs";
import * as gulp from "gulp";
import * as convertEncoding from "gulp-convert-encoding";
import chalk from "chalk";

import { printResults, includesPaths } from "../common/utility";
import { workspaceConfig as config } from "../common/config";
import { getOnlyChangedFiles } from "../common/globs";
import { compileFile, compileSelection } from "../common/base";
import * as git from "../common/git";
import { exportFilesFromDbAsync } from "../tasks/import";

import * as noop from "gulp-noop";
import * as data from "gulp-data";

const compileFilesToDb = async ({
  file = argv.file,
  env = argv.env || "DEV",
  changed = argv.changed || false,
  user = argv.user,
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
      resp = await compileFile(file.contents, file.path, env, force, warnings, <string>user);
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
  if (src.length === 0) {
    src.push("nonvalidfile");
  }
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

// unused
// const compileEverywhere = async ({ file, env }) => {
//   if (!file) { throw Error("File cannot be empty."); }
//   // Compile to env
//   const results = await compileFilesToDbAsync({ file, env });
//   // If no errors deploy
//   if (!results.some(file => file.errors.hasErrors())) {
//     await compileFilesToDbAsync({ file, env: "TEST" });
//     await compileFilesToDbAsync({ file, env: "UAT" });
//   }
// };

export const compileOnSaveTask = ({ env = argv.env || "DEV" }) => {
  // Watch for files changes in source dir
  const source = config.get("source.input");
  const watcher = gulp.watch(source, { awaitWriteFinish: true });
  console.log(chalk.magenta(`Watching for file changes in ${source} ...`));
  watcher.on("change", async (file) => {
    // Print pattern for start problem matching
    console.log(`\nStarting compilation...`);
    // Compile changes in working tree
    const files = await getOnlyChangedFiles(source);
    await compileFilesToDbAsync({ env, file: files });
    // Always compile saved path (even if nothing changes)
    if (!includesPaths(files, file)) {
      await compileFilesToDbAsync({ env, file });
    }
    // Print pattern that ends problem matching
    console.log("Compilation complete.");
  });
};

const compileFilesToDbAsync = async ({ file, env, changed = false }) => {
  let results = [];
  return new Promise(async (res, rej) => {
    const p = await compileFilesToDb({ file, env, changed });
    // Collect results
    p.on("data", (resp) => results.push(resp.data));
    // Return results
    p.on("end", () => res(results));
    p.on("error", rej);
  });
};

const mergeLocalAndDbChanges = async ({ file = argv.file, env = argv.env, changed = argv.changed }) => {
  const source = config.get({ field: "source.input", env });
  const src = file || (changed ? await getOnlyChangedFiles(source) : source);

  if (src.length !== 0) {
    try {
      await git.stash();
      await exportFilesFromDbAsync({ file: src, env, quiet: true });
      await git.unstash();
    } catch (error) {
      // Git throws error when changes need merging
      console.log(error.message);
    }
  }
};

const compileAndMergeFilesToDb = async ({
  file = argv.file,
  env = argv.env || "DEV",
  changed = (argv.changed as boolean) || false,
}) => {
  try {
    // Compile and get error results
    const results: any = await compileFilesToDbAsync({ file, env, changed });
    // Merge unstaged (if any dirty file)
    if (results.some((file) => file.errors && file.errors.hasDirt())) {
      mergeLocalAndDbChanges({ file, env, changed });
    }

    // Update todo.md

    // extractTodos();
  } catch (error) {
    throw error;
  }
};

export const compileTestTask = ({ env = argv.env || "DEV" }) => {
  const input = config.get({ field: "test.input", env });
  return compileFilesToDbAsync({ file: input, env });
};

const compileObjectToDb = async ({
  file = argv.file,
  env = argv.env || "DEV",
  object = argv.object,
  line = argv.line,
  user = argv.user as string,
}) => {
  try {
    if (!object) {
      throw Error("Object cannot be empty.");
    }
    let resp = await compileSelection(object, file, env, line, user);
    printResults(resp);
  } catch (err) {
    console.error(err.message);
  }
};

export function compileTask({
  env = argv.env || "DEV",
  file = argv.file,
  changed = (argv.changed as boolean) || false,
  object = argv.object,
  line = argv.line,
}) {
  if (object) {
    return compileObjectToDb({ file, env, object, line });
  } else {
    return compileAndMergeFilesToDb({ file, env, changed });
  }
}
