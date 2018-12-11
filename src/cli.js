#!/usr/bin/env node

const { resolve } = require("path");
import { TaskManager } from "./TaskManager";
import * as program from "commander";

const workspacePath = process.cwd();
const contextPath = resolve(__dirname, "..");

process.env.silent = "true";
const taskManager = new TaskManager(workspacePath, contextPath, workspacePath);
const execute = () => taskManager.executeOradewTask(process.argv);

program
  .name("oradew")
  .version("0.0.1")
  .usage("<command> [options]");

program
  .command("initWorkspace")
  .description("Initialize Workspace")
  .action(() => execute());

program
  .command("createSource")
  .description("Import All Objects from Db to Source")
  .option("-e, --env <env>", "DB Environment")
  .action(() => execute());

program
  .command("compileFiles")
  .description("Compile files (all source if no file specified)")
  .option("-e, --env <env>", "DB Environment")
  .option("-f, --file <file>", "Absolute path of file")
  .option("--changed", "Changed files from working tree")
  .option("--force", "Overwrite changes on DB")
  .action(() => execute());

program
  .command("compileObject")
  .description("Compile selected object")
  .option("-e, --env <env>", "DB Environment")
  .option("-o, --object <object>", "Selected text-object")
  .option("-f, --file <file>", "Absolute path of file")
  .option("-l, --line <line>", "Line offset in file - start of object")
  .action(() => execute());

program
  .command("importFiles")
  .description("Import files (all source if no file specified)")
  .option("-e, --env <env>", "DB Environment")
  .option("-f, --file <file>", "Absolute path of file")
  .option("--changed", "Changed files from working tree")
  .option("--ease", "Import only if DB object changed")
  .option("--quiet", "Suppress console output")
  .action(() => execute());

program
  .command("importObject")
  .description("Import selected object")
  .option("-e, --env <env>", "DB Environment")
  .option("-o, --object <object>", "Object name")
  .action(() => execute());

program
  .command("package")
  .description("Package")
  .option("-e, --env <env>", "DB Environment")
  .action(() => execute());

program
  .command("runFile")
  .description(
    "Run file as a Script (path package.deploy if no file specified)"
  )
  .option("-e, --env <env>", "DB Environment")
  .option("-f, --file <file>", "Absolute path of file")
  .action(() => execute());

program
  .command("runTest")
  .description("Run unit tests")
  .option("-e, --env <env>", "DB Environment")
  .action(() => execute());

program.parse(process.argv);
