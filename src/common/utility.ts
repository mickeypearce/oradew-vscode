import { resolve } from "path";
import { outputFile } from "fs-extra";
import { exec } from "child_process";

import chalk from "chalk";
import * as Table from "cli-table";

const promisify = (func) => (...args) =>
  new Promise((resolve, reject) =>
    func(...args, (err, result) => (err ? reject(err) : resolve(result)))
  );

export const execPromise = promisify(exec);
export const outputFilePromise = promisify(outputFile);

export const removeNewlines = (str) => str.replace(/\r\n|\r|\n/gi, " ");

// alternative /\r?\n/
export const splitLines = (str) => str.split(/\r\n|\r|\n/);

// Conditionally prepends char if it doesn't starts already
// prependCheck("a")("aabc") => 'aabc'
// prependCheck("a")("bbc") => 'abbc'
export const prependCheck = (val) => (str) => (str.startsWith(val) ? str : `${val}${str}`);

// Add ./ if it doesn't already exists
export const rootPrepend = prependCheck("./");
// Remove ./ from path
export const rootRemove = (str) => str.replace(/\.\//, "");

/**
 * Includes - case insensitive.
 * * arr includes str?
 * @param {array} arr
 * @param {string} str
 * @returns {boolean}
 */
export const includesCaseInsensitive = (arr, str) => {
  let upp = arr.map((v) => v.toUpperCase());
  return upp.includes(str.toUpperCase());
};

/**
 * Includes paths - absolute or relative.
 * * arrPaths includes path?
 * @param {array} arrPaths
 * @param {string} path
 * @returns {boolean}
 */
export const includesPaths = (arrPaths, path) => {
  let absPaths = arrPaths.map((p) => resolve(p));
  let absPath = resolve(path);
  return absPaths.includes(absPath);
};

export const getLogFilename = (filename) => `spool__${filename}.log`;

export const printResults = (resp) => {
  // Print column names and rows data
  if (resp.result) {
    let rows = resp.result.rows;
    if (rows) {
      // Replace null values with '(null)'
      rows = rows.map((r) => r.map((v) => (v === null ? "(null)" : v)));
      const table = new Table({
        head: resp.result.metaData.map((col) => col.name),
        style: { head: ["cyan"] },
      });
      table.push(...rows);
      console.log(table.toString());
    }
    // Print affected rows
    if (resp.result.rowsAffected) {
      console.log(
        // chalk.magenta(
        `${resp.result.rowsAffected} ${resp.result.rowsAffected === 1 ? "row" : "rows"} affected.`

        // )
      );
    }
  }
  // Print dbms output
  if (resp.lines && resp.lines.length !== 0) {
    console.log(chalk.blue(resp.lines.join("\n")));
  }

  // Generate status msg
  const status = resp.errors.hasErrors() ? chalk.bgRed("Failure") : chalk.green("Success");
  console.log(`${status} => ${resp.obj.owner}@${resp.env} $${resp.file}`);
  // Concat errors to problem matcher format
  const errMsg = resp.errors.toString();
  if (errMsg) {
    console.log(`${errMsg}`);
  }
};
