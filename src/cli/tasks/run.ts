import { argv } from "yargs";
import * as fs from "fs-extra";
import * as path from "path";
import { pipe, replace, trim } from "lodash/fp";
import { decode } from "iconv-lite";

import { parseForErrors } from "../common/db";
import { runFileAsScript } from "../common/base";
import { getLogFilename, printResults } from "../common/utility";
import { workspaceConfig as config } from "../common/config";
import { matchOutputFiles } from "../common/dbobject";

export async function runTask({
  file = argv.file,
  env = argv.env || "DEV",
  user = argv.user as string,
}) {
  // Convert to array as parameters can be arrays (--file a --file b)
  let filesToRun = file && [].concat(file);

  // Match file from package.output pattern if no --file
  if (!filesToRun) {
    const output = config.get({ field: "package.output", env });
    filesToRun = matchOutputFiles(output);
  }

  if (filesToRun.length !== 1) {
    console.log(`Multiple or none scripts detected: ${filesToRun}`);
    console.log(`Use "--file" parameter to run a script.`);
    return;
  }

  const filePath = path.resolve(filesToRun[0]);

  if (!fs.existsSync(filePath)) {
    console.log(`File does not exist: ${filePath}`);
    console.log(`Use "Package" command to create a deployment script.`);
    return;
  }

  const outputFileName = path.basename(filePath);
  const outputDirectory = path.dirname(filePath);

  // Default log file that packaged scripts spools to
  const logPath = path.join(outputDirectory, getLogFilename(outputFileName));

  // Append 'env' to the log's filename to differentiate beetwen logs
  const logPathEnv = path.join(outputDirectory, getLogFilename(`${outputFileName}-${env}`));

  // Simple output err colorizer
  const sanitize = (text) =>
    pipe(
      // Remove carriage returns
      replace(/\r\n/g, "\n"),
      // Remove double new-lines
      replace(/(\n\r)+/g, "\n"),
      trim
      // Color red to the line that contains ERROR
      // replace(/^.*ERROR.*$/gm, chalk.red("$&")),
      // Color orange to the line that contains Warning
      // replace(/^.*Warning:.*$/gm, chalk.yellow("$&"))
    )(text);

  try {
    const { stdout, obj } = await runFileAsScript(filePath, env, user);

    const srcEncoding = config.get({ field: "source.encoding", env });
    const decoded = decode(stdout as Buffer, srcEncoding);
    const out = sanitize(decoded);

    const errors = parseForErrors(out);

    // Prints errors in problem matcher format (one error per line)
    printResults({ errors, obj, env, file: filePath });

    // Outputs stdout
    console.log("=============================== STDOUT ===============================");
    console.log(out);

    // Add env suffix to log file if it exists
    if (fs.existsSync(logPath)) {
      fs.renameSync(logPath, logPathEnv);
    }
  } catch (error) {
    console.error(`${error.message}`);
  }
}
