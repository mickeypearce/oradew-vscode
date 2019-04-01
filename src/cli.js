#!/usr/bin/env node

const { resolve } = require("path");
import { TaskManager } from "./task-manager";
import * as program from "commander";

// ENVironment variables:

// cwd: workspace path (current working dir by default)
// color: gulp output in colors (true by default)
// silent: without gulp output (true by default)
// dbconfig: DB config path (./dbconfig.json by default)
// wsconfig: Workspace config path (./oradewrc.json by default)

// Examples in powershell:
// $env:silent="false"
// $env:dbconfig="./.vscode/dbconfig.json"

// WS is current dir by default
const workspacePath = process.env.cwd || process.cwd();

const contextPath = resolve(__dirname, "..");
const storagePath = workspacePath;

// Configs are in WS dir by default
const dbConfigPath =
  process.env.dbconfig || resolve(workspacePath, "dbconfig.json");
const wsConfigPath =
  process.env.wsconfig || resolve(workspacePath, "oradewrc.json");

const isColor = (process.env.color || "true") === "true";
const isSilent = (process.env.silent || "true") === "true";

const taskManager = new TaskManager({
  workspacePath,
  contextPath,
  storagePath,
  dbConfigPath,
  wsConfigPath,
  isSilent,
  isColor
});
const execute = () => taskManager.executeOradewTask(process.argv);

program
  .name("oradew")
  .version("0.1.0")
  .usage("<command> [options]");

program
  .command("init")
  .description("Initialize a new workspace")
  .option("--prompt", "With input prompts")
  .action(() => execute());

program
  .command("create")
  .description("Import All Objects from Db to Source")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .action(() => execute());

program
  .command("compile")
  .description("Compile Source files to DB")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .option("--changed", "Only files in working tree (changes)")
  .option("--file <file>", "Path of file.")
  .option("--object <object>", "DB statement (query or block)")
  .option("--line <line>", "Line offset of statement in file. 1 by default")
  .action(() => execute());

program
  .command("import")
  .description("Import Source files from DB")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .option("--changed", "Only files in working tree (changes")
  .option("--ease", "Only files (objects) that changed on DB")
  .option("--file <file>", "Path of file.")
  .option("--quiet", "Suppress console output")
  .option("--object <object>", "DB object name")
  .action(() => execute());

program
  .command("package")
  .description("Package files to deployment script")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .option("--delta", "Only changed files")
  .action(() => execute());

program
  .command("deploy")
  .alias("run")
  .description("Run script (with SQLPlus)")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .option("--file <file>", "Path of file. 'package.output' if not specified.")
  .action(() => execute());

program
  .command("test")
  .description("Run unit tests")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .action(() => execute());

program
  .command("generate")
  .description("Code generator")
  .option("--func <func>", "DB generator function (required)")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .option(
    "--file <file>",
    "Path of file. (func. param mapping: ./src/${schema}/${object_type}/${name}.sql)"
  )
  .option(
    "--object <object>",
    "Object name. (func. param mapping: selected_object)"
  )
  .option(
    "--output <output>",
    "Result output path. Generated file name if not specified."
  )
  .action(() => execute());

program
  .command("watch")
  .description("Compile when Source file changes")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .action(() => execute());

program.parse(process.argv);
