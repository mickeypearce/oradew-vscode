"use strict";

import * as vscode from "vscode";

import { ConfigurationManager } from "./common/configuration-manager";
import { setInitialized } from "./common/activation";
import { Telemetry } from "./common/telemetry";
import { GeneratorController } from "./controllers/generator-controller";
import { EnvironmentController } from "./controllers/environment-controller";
import { UserController } from "./controllers/user-controller";
import { FileController } from "./controllers/file-controller";
import { OradewTaskProvider, createCompileOnSaveTask } from "./task-provider";
import { OradewProcess } from "@Cli/process";

let oradewTaskProvider: vscode.Disposable | undefined;
let environmentController: EnvironmentController;
let userController: UserController;
let generatorController: GeneratorController;
let fileController: FileController;
let oradewProcess: OradewProcess;

// The extension deactivate method is asynchronous, so we handle the disposables ourselves instead of using extensonContext.subscriptions.
const disposables: vscode.Disposable[] = [];

export function activate(context: vscode.ExtensionContext) {
  let settings = ConfigurationManager.getInstance();
  const {
    workspaceDir,
    chatty,
    workspaceConfigFile,
    databaseConfigFile,
    cliExecutable,
    envVariables,
  } = settings;

  // Reload if dbconfig created...
  let watcher = vscode.workspace.createFileSystemWatcher(databaseConfigFile);
  watcher.onDidCreate(() => {
    deactivate();
    activate(context);
  });

  // Set context inOradewProject
  setInitialized();

  // Reactivate extension when settings.json changes as databaseConfigPath file
  // which is activation trigger can be defined in settings
  vscode.workspace.onDidChangeConfiguration(() => {
    settings.initializeSettings();
    deactivate();
    activate(context);
  });

  const cliDir = context.extensionPath;
  const storageDir = context.storagePath || context.extensionPath;

  // OradewProcess is used for getting processEnv variable which contains the same env variables that are passed to Oradew CLI
  oradewProcess = new OradewProcess({
    workspaceDir,
    cliDir,
    storageDir,
    dbConfigPath: databaseConfigFile,
    wsConfigPath: workspaceConfigFile,
    isSilent: !chatty,
    isColor: true,
    cliExecutable,
    envVariables,
  });

  generatorController = new GeneratorController();
  environmentController = new EnvironmentController(context);
  userController = new UserController(context, environmentController);

  oradewTaskProvider = vscode.tasks.registerTaskProvider(
    OradewTaskProvider.OradewType,
    new OradewTaskProvider(oradewProcess)
  );

  fileController = new FileController(environmentController);

  // Internal command: env paramater selection in commands
  let cmdGetEnvironment = vscode.commands.registerCommand(
    "oradew.getEnvironment",
    environmentController.getEnvironment
  );
  // Internal command: used for deploy task command
  let cmdPickEnvironment = vscode.commands.registerCommand(
    "oradew.pickEnvironment",
    environmentController.pickEnvironment
  );

  let cmdSetDbEnvironment = vscode.commands.registerCommand(
    "oradew.setDbEnvironment",
    environmentController.setDbEnvironment
  );

  let cmdClearDbEnvironment = vscode.commands.registerCommand(
    "oradew.clearDbEnvironment",
    environmentController.clearDbEnvironment
  );

  // Internal command: function paramater selection in generator task
  let cmdGetGeneratorFunction = vscode.commands.registerCommand(
    "oradew.getGeneratorFunction",
    generatorController.getGeneratorFunction
  );

  // Internal command: user paramater selection in commands
  let cmdGetUser = vscode.commands.registerCommand("oradew.getUser", userController.getUser);
  // Internal command: used for deploy task command
  let cmdPickUser = vscode.commands.registerCommand("oradew.pickUser", userController.pickUser);

  let cmdSetDbUser = vscode.commands.registerCommand("oradew.setDbUser", userController.setDbUser);

  // Internal command: file paramater selection in deploy command
  let cmdPickPackageScript = vscode.commands.registerCommand(
    "oradew.pickPackageScript",
    fileController.pickPackageScript
  );

  /************** */

  let cmdTaskGenerate = vscode.commands.registerCommand("oradew.generateTask", async () => {
    vscode.commands.executeCommand("workbench.action.tasks.runTask", "oradew: generator");
    Telemetry.sendEvent("generateTask");
  });
  let cmdTaskInitProject = vscode.commands.registerCommand("oradew.initProjectTask", async () => {
    await vscode.commands.executeCommand("workbench.action.tasks.runTask", "oradew: init");
    setInitialized();
    Telemetry.sendEvent("initProjectTask");
  });
  let cmdTaskCreateProject = vscode.commands.registerCommand("oradew.createProjectTask", () => {
    vscode.commands.executeCommand("workbench.action.tasks.runTask", "oradew: create");
    Telemetry.sendEvent("createProjectTask");
  });
  let cmdTaskCompile = vscode.commands.registerCommand("oradew.compileTask", () => {
    vscode.commands.executeCommand("workbench.action.tasks.runTask", "oradew: compile--changed");
    Telemetry.sendEvent("compileTask");
  });
  let cmdTaskCompileAll = vscode.commands.registerCommand("oradew.compileAllTask", () => {
    vscode.commands.executeCommand("workbench.action.tasks.runTask", "oradew: compile");
    Telemetry.sendEvent("compileAllTask");
  });
  let cmdTaskCompileFile = vscode.commands.registerCommand("oradew.compileFileTask", () => {
    vscode.commands.executeCommand("workbench.action.tasks.runTask", "oradew: compile--file");
    Telemetry.sendEvent("compileFileTask");
  });
  let cmdTaskCompileObject = vscode.commands.registerCommand("oradew.compileObjectTask", () => {
    vscode.commands.executeCommand("workbench.action.tasks.runTask", "oradew: compile--object");
    Telemetry.sendEvent("compileObjectTask");
  });
  let cmdTaskExport = vscode.commands.registerCommand("oradew.importTask", () => {
    vscode.commands.executeCommand("workbench.action.tasks.runTask", "oradew: import");
    Telemetry.sendEvent("importTask");
  });
  let cmdTaskExportFile = vscode.commands.registerCommand("oradew.importFileTask", () => {
    vscode.commands.executeCommand("workbench.action.tasks.runTask", "oradew: import--file");
    Telemetry.sendEvent("importFileTask");
  });
  let cmdTaskExportObject = vscode.commands.registerCommand("oradew.importObjectTask", () => {
    vscode.commands.executeCommand("workbench.action.tasks.runTask", "oradew: import--object");
    Telemetry.sendEvent("importObjectTask");
  });
  let cmdTaskPackage = vscode.commands.registerCommand("oradew.packageTask", () => {
    vscode.commands.executeCommand("workbench.action.tasks.runTask", "oradew: package");
    Telemetry.sendEvent("packageTask");
  });
  let cmdTaskPackageDelta = vscode.commands.registerCommand("oradew.packageDeltaTask", () => {
    vscode.commands.executeCommand("workbench.action.tasks.runTask", "oradew: package--delta");
    Telemetry.sendEvent("packageDeltaTask");
  });
  let cmdTaskDeploy = vscode.commands.registerCommand("oradew.deployTask", () => {
    vscode.commands.executeCommand("workbench.action.tasks.runTask", "oradew: deploy");
    Telemetry.sendEvent("deployTask");
  });
  let cmdTaskRunFile = vscode.commands.registerCommand("oradew.runFileTask", () => {
    vscode.commands.executeCommand("workbench.action.tasks.runTask", "oradew: run--file");
    Telemetry.sendEvent("runFileTask");
  });
  let cmdTaskTest = vscode.commands.registerCommand("oradew.testTask", () => {
    vscode.commands.executeCommand("workbench.action.tasks.runTask", "oradew: test");
    Telemetry.sendEvent("testTask");
  });
  let taskExec: Thenable<vscode.TaskExecution>;
  let cmdTaskCompileOnSave = vscode.commands.registerCommand("oradew.compileOnSaveTask", () => {
    // Get our task from active executions (terminate doesn't delete from taskexecution!)
    // let taskExec = vscode.tasks.taskExecutions.filter(
    //   t => t.task.name === "compileOnSave"
    // )[0];
    // If if doesn't exist - execute, otherwise terminate.
    if (!taskExec) {
      let _task = createCompileOnSaveTask();
      taskExec = vscode.tasks.executeTask(_task);
    } else {
      taskExec.then((task) => task.terminate());
      taskExec = null;
    }
    Telemetry.sendEvent("compileOnSaveTask");
  });

  disposables.push(cmdTaskGenerate);
  disposables.push(cmdTaskInitProject);
  disposables.push(cmdTaskCreateProject);
  disposables.push(cmdTaskCompile);
  disposables.push(cmdTaskCompileAll);
  disposables.push(cmdTaskCompileFile);
  disposables.push(cmdTaskCompileObject);
  disposables.push(cmdTaskExport);
  disposables.push(cmdTaskExportFile);
  disposables.push(cmdTaskExportObject);
  disposables.push(cmdTaskPackage);
  disposables.push(cmdTaskPackageDelta);
  disposables.push(cmdTaskDeploy);
  disposables.push(cmdTaskRunFile);
  disposables.push(cmdTaskTest);
  disposables.push(cmdTaskCompileOnSave);

  // Internal
  disposables.push(cmdGetEnvironment);
  disposables.push(cmdPickEnvironment);
  disposables.push(cmdGetGeneratorFunction);
  disposables.push(cmdGetUser);
  disposables.push(cmdPickUser);
  disposables.push(cmdSetDbUser);
  disposables.push(cmdPickPackageScript);

  disposables.push(cmdSetDbEnvironment);
  disposables.push(cmdClearDbEnvironment);

  // Telemetry
  disposables.push(Telemetry.reporter);
}

// this method is called when your extension is deactivated
export function deactivate(): void {
  if (oradewTaskProvider) {
    oradewTaskProvider.dispose();
  }
  if (environmentController) {
    environmentController.dispose();
  }
  if (userController) {
    userController.dispose();
  }
  Telemetry.deactivate();
  disposables.forEach((d) => d.dispose());
}
