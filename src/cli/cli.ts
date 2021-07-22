import { resolve } from "path";
import { homedir } from "os";
import * as program from "commander";

import { OradewProcess } from "./process";
import { version } from "../../package.json";

// ENVironment variables:

// ORADEW_CWD: workspace directory (current working dir by default)
// ORADEW_COLOR: gulp output in colors (true by default)
// ORADEW_SILENT: without gulp output (true by default)
// ORADEW_DB_CONFIG_PATH: DB config path (./dbconfig.json by default)
// ORADEW_WS_CONFIG_PATH: Workspace config path (./oradewrc.json by default)
// ORADEW_STORAGE_DIR: Storage directory
// ORADEW_CLI_EXECUTABLE: DB executable cli

// Examples in powershell:
// $env:ORADEW_SILENT="false"
// $env:ORADEW_DB_CONFIG_PATH="./.vscode/dbconfig.json"
// Examples in bash:
// export ORADEW_STORAGE_DIR=/root/.vscode-server/data/User/workspaceStorage/23e6f2d18f63fad4517cc3121396a6d9/mp.oradew-vscode/

// WS is current dir by default
const workspaceDir = process.env.ORADEW_CWD || process.cwd();

// Extension location path
const cliDir = resolve(__dirname, "..");

const storageDir = process.env.ORADEW_STORAGE_DIR || homedir();

// Configs are in WS dir by default
const dbConfigPath = process.env.ORADEW_DB_CONFIG_PATH || resolve(workspaceDir, "dbconfig.json");
const wsConfigPath = process.env.ORADEW_WS_CONFIG_PATH || resolve(workspaceDir, "oradewrc.json");

const isColor = (process.env.ORADEW_COLOR || "true") === "true";
const isSilent = (process.env.ORADEW_SILENT || "true") === "true";

const cliExecutable = process.env.ORADEW_CLI_EXECUTABLE || "sql";
const cliCommand = process.env.ORADEW_CLI_COMMAND;

const oradewProcess = new OradewProcess({
  workspaceDir,
  cliDir,
  storageDir,
  dbConfigPath,
  wsConfigPath,
  isSilent,
  isColor,
  cliExecutable,
  cliCommand,
});
const execute = () => oradewProcess.execute(process.argv);

program.name("oradew").version(version).usage("<command> [options]");

program.on("--help", function () {
  console.log("");
  console.log("(Use `oradew <command> --help` for command options.)");
  console.log("");
  console.log("Environment variables:");
  console.log("ORADEW_CWD             Workspace directory (current working dir by default)");
  console.log("ORADEW_DB_CONFIG_PATH  DB config file path (./dbconfig.json by default)");
  console.log("ORADEW_WS_CONFIG_PATH  Workspace config file path (./oradewrc.json by default)");
  console.log("ORADEW_STORAGE_DIR     Storage directory (user's home directory by default)");
  console.log("ORADEW_CLI_EXECUTABLE  OracleDB executable CLI (sql or sqlplus, 'sql' by default)");
  console.log("ORADEW_COLOR           Debug: Gulp outputs in colors (true by default)");
  console.log("ORADEW_SILENT          Debug: Gulp outputs silent (true by default)");
});

program
  .command("init")
  .description("Initialize a new workspace")
  .action(() => execute());

program
  .command("create")
  .description("Create Source files and import from DB objects")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .option("--file <file>", 'File path or a glob. "source.input" if not specified.')
  .action(() => execute());

program
  .command("compile")
  .description("Compile Source files to DB")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .option("--file <file>", 'File path or a glob. "source.input" if not specified.')
  .option("--changed", "Only files in working tree (changes). False by default.")
  .option("--force", "Ignore conflict and overwrite DB object. True by default.")
  .option("--object <object>", "PL/SQL statement (query or block - in double quotes) to compile")
  .option("--line <line>", "Line offset of a statement in file. 1 by default.")
  .option("--user <user>", "DB User. <Auto> (extracted from file path) if not specified.")
  .action(() => execute());

program
  .command("import")
  .description("Import Source files from DB")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .option("--file <file>", 'File path or a glob. "source.input" if not specified.')
  .option("--changed", "Only files in working tree (changes). False by default.")
  .option("--ease", "Only files (objects) that changed on DB. False by default.")
  .option("--quiet", "Suppress console output. False by default.")
  .option("--object <object>", "DB object name to import")
  .option("--user <user>", "DB User. <Auto> (extracted from file path) if not specified.")
  .action(() => execute());

program
  .command("package")
  .description("Package files to deployment script")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .option("--delta", "Changed files from latest tagged commit up to head")
  .option("--from <commit>", "Changed files from specified commit up to head")
  .option("--commit <commit>", "Changed files from specific commit(s)")
  .option("--append", 'Append file paths not yet included to "package.input"')
  .action(() => execute());

program
  .command("deploy")
  .alias("run")
  .description("Run script (with SQL*Plus or SQLcl)")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .option("--file <file>", 'File path. "package.output" if not specified.')
  .option("--user <user>", "DB User. <Auto> (extracted from file path) if not specified.")
  .action(() => execute());

program
  .command("test")
  .description("Run unit tests")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .option("--user <user>", "DB User. <Auto> (extracted from file path) if not specified.")
  .action(() => execute());

program
  .command("generate")
  .description("Code generator")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .option("--func <func>", "Generator function name on DB (required)")
  .option("--file <file>", "File path. (func. params: ./src/${schema}/${object_type}/${name}.sql)")
  .option("--object <object>", "Object name. (func. param mapping: selected_object)")
  .option("--output <output>", "Output file path. Generated file name if not specified.")
  .option("--user <user>", "DB User. <Auto> (extracted from file path) if not specified.")
  .action(() => execute());

program
  .command("watch")
  .description("Compile when Source file changes")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .option("--user <user>", "DB User. <Auto> (extracted from file path) if not specified.")
  .action(() => execute());

export { program };
