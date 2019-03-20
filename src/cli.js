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
  .version("0.0.2")
  .usage("<command> [options]");

program
  .command("initWorkspace")
  .description("Initialize a new workspace")
  .option("--prompt", "With input prompts")
  .action(() => execute());

program
  .command("createSource")
  .description("Import All Objects from Db to Source")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .action(() => execute());

program
  .command("compileFiles")
  .description("Compile files")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .option("--file <file>", "Path of file. all 'source' if not specified.")
  .option("--changed", "Only changed files from working tree")
  .action(() => execute());

program
  .command("compileObject")
  .description("Compile object (statement)")
  .option("--object <object>", "DB statement (query or block) (required)")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .option("--file <file>", "Path of file")
  .option("--line <line>", "Line offset of statement in file")
  .action(() => execute());

program
  .command("importFiles")
  .description("Import source files from DB")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .option("--file <file>", "Path of file. all 'source' if not specified.")
  .option("--changed", "Only changed files from working tree")
  .option("--ease", "Skip files (objects) that hasn't changed on DB")
  .option("--quiet", "Suppress console output")
  .action(() => execute());

program
  .command("importObject")
  .description("Import object from DB")
  .option("--object <object>", "DB object name (required)")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .action(() => execute());

program
  .command("package")
  .description("Package files to deploy script")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .action(() => execute());

program
  .command("deploy")
  .alias("runFile")
  .description("Run script (with SQLPlus)")
  .option("--env <env>", "DB Environment. DEV if not specified.")
  .option("--file <file>", "Path of file. 'package.output' if not specified.")
  .action(() => execute());

program
  .command("runTest")
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

program.parse(process.argv);
