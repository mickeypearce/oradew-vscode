#!/usr/bin/env node

const { resolve } = require("path");
import { TaskManager } from "./TaskManager";
import * as program from "commander";

// ENVironment variables:
// cwd: workspace path (current working dir by default)
// color: gulp output in colors (true by default)
// silent: without gulp output (true by default)
// example in powershell: $env:silent="false"
const workspacePath = process.env.cwd || process.cwd();
const contextPath = resolve(__dirname, "..");
const storagePath = workspacePath;
const isColor = (process.env.color || "true") === "true";
const isSilent = (process.env.silent || "true") === "true";

const taskManager = new TaskManager({
  workspacePath,
  contextPath,
  storagePath,
  isSilent,
  isColor
});
const execute = () => taskManager.executeOradewTask(process.argv);

program
  .name("oradew")
  .version("0.0.1")
  .usage("<command> [options]");

program
  .command("initWorkspace")
  .description("Initialize a new workspace")
  .option("--prompt", "With input prompts")
  .action(() => execute());

program
  .command("createSource")
  .description("Import All Objects from Db to Source")
  .option("--env <env>", "DB Environment")
  .action(() => execute());

program
  .command("compileFiles")
  .description("Compile files (all source if no file specified)")
  .option("--env <env>", "DB Environment")
  .option("--file <file>", "Absolute path of file")
  .option("--changed", "Changed files from working tree")
  .option("--force", "Overwrite changes on DB")
  .action(() => execute());

program
  .command("compileObject")
  .description("Compile object")
  .option("--env <env>", "DB Environment")
  .option("--object <object>", "DB statement (query or block)")
  .option("--file <file>", "Absolute path of file")
  .option("--line <line>", "Line offset in file - start of object")
  .action(() => execute());

program
  .command("importFiles")
  .description("Import files (all source if no file specified)")
  .option("--env <env>", "DB Environment")
  .option("--file <file>", "Absolute path of file")
  .option("--changed", "Changed files from working tree")
  .option("--ease", "Import only if DB object changed")
  .option("--quiet", "Suppress console output")
  .action(() => execute());

program
  .command("importObject")
  .description("Import object")
  .option("--env <env>", "DB Environment")
  .option("--object <object>", "DB object name")
  .action(() => execute());

program
  .command("package")
  .description("Package")
  .option("--env <env>", "DB Environment")
  .action(() => execute());

program
  .command("deploy")
  .alias("runFile")
  .description("Run as a Script (package.output if no file specified)")
  .option("--env <env>", "DB Environment")
  .option("--file <file>", "Absolute path of file")
  .action(() => execute());

program
  .command("runTest")
  .description("Run unit tests")
  .option("--env <env>", "DB Environment")
  .action(() => execute());

program.parse(process.argv);
