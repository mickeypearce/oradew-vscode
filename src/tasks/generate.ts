

import * as path from "path";
import { argv } from "yargs";
import chalk from "chalk";

import { outputFilePromise } from "../common/utility";
import { getGenerator } from "../common/base";


export const generateTask = async ({
  env = argv.env || "DEV",
  func = argv.func,
  file = argv.file,
  object = argv.object,
  output = argv.output,
  user = argv.user
}) => {
  try {
    if (!func) { throw Error("Func cannot be empty."); }

    const resp = await getGenerator({ func, file, env, object, user });

    // Save to output argument if it exists
    // otherwise save to generated file in ./script directory
    const outputPath = output
      ? path.resolve(output)
      : path.resolve(
        `./scripts/${
        resp.obj.owner
        }/file_${object}_${new Date().getTime()}.sql`
      );

    await outputFilePromise(outputPath, resp.result);
    console.log(`${outputPath} ${chalk.green("created.")}`);
  } catch (err) {
    console.error(err.message);
  }
};
