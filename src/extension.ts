"use strict";

import * as vscode from "vscode";

import { GeneratorManager } from "./generator-manager";
import { EnvironmentController } from "./environment-controller";
import { ConfigurationController } from "./configuration-controller";
import { setInitialized } from "./activation";
import { OradewTaskProvider, createCompileOnSaveTask } from './oradew-task-provider';
import { Telemetry } from "./telemetry";


let oradewTaskProvider: vscode.Disposable | undefined;
let environmentController: EnvironmentController;
let generatorManager: GeneratorManager;

export function activate(context: vscode.ExtensionContext) {

  let settings = ConfigurationController.getInstance();

  // let watcher = vscode.workspace.createFileSystemWatcher(dbConfigPath);
  // watcher.onDidCreate(() => {
  //   activate(context);
  // });

  // Set context inOradewProject
  setInitialized();

  // Reactivate extension when settings.json changes as databaseConfigPath file
  // which is activation trigger can be defined in settings
  vscode.workspace.onDidChangeConfiguration(() => {
    settings.initializeSettings();
    deactivate();
    activate(context);
  });


  generatorManager = new GeneratorManager();
  environmentController = new EnvironmentController(context);

  oradewTaskProvider = vscode.tasks.registerTaskProvider(OradewTaskProvider.OradewType, new OradewTaskProvider(context));


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
    generatorManager.getGeneratorFunction
  );

  /************** */

  let cmdTaskGenerate = vscode.commands.registerCommand(
    "oradew.generateTask",
    async () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "oradew: generator"
      );
      Telemetry.sendEvent("generateTask");
    }
  );
  let cmdTaskInitProject = vscode.commands.registerCommand(
    "oradew.initProjectTask",
    async () => {
      await vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "oradew: init"
      );
      setInitialized();
      Telemetry.sendEvent("initProjectTask");
    }
  );
  let cmdTaskCreateProject = vscode.commands.registerCommand(
    "oradew.createProjectTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "oradew: create"
      );
      Telemetry.sendEvent("createProjectTask");
    }
  );
  let cmdTaskCompile = vscode.commands.registerCommand(
    "oradew.compileTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "oradew: compile"
      );
      Telemetry.sendEvent("compileTask");
    }
  );
  let cmdTaskCompileAll = vscode.commands.registerCommand(
    "oradew.compileAllTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "oradew: compile--all"
      );
      Telemetry.sendEvent("compileAllTask");
    }
  );
  let cmdTaskCompileFile = vscode.commands.registerCommand(
    "oradew.compileFileTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "oradew: compile--file"
      );
      Telemetry.sendEvent("compileFileTask");
    }
  );
  let cmdTaskCompileObject = vscode.commands.registerCommand(
    "oradew.compileObjectTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "oradew: compile--object"
      );
      Telemetry.sendEvent("compileObjectTask");
    }
  );
  let cmdTaskExport = vscode.commands.registerCommand(
    "oradew.exportTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "oradew: export"
      );
      Telemetry.sendEvent("exportTask");
    }
  );
  let cmdTaskExportFile = vscode.commands.registerCommand(
    "oradew.exportFileTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "oradew: export--file"
      );
      Telemetry.sendEvent("exportFileTask");
    }
  );
  let cmdTaskExportObject = vscode.commands.registerCommand(
    "oradew.exportObjectTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "oradew: export--object"
      );
      Telemetry.sendEvent("exportObjectTask");
    }
  );
  let cmdTaskPackage = vscode.commands.registerCommand(
    "oradew.packageTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "oradew: package"
      );
      Telemetry.sendEvent("packageTask");
    }
  );
  let cmdTaskPackageDelta = vscode.commands.registerCommand(
    "oradew.packageDeltaTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "oradew: package--delta"
      );
      Telemetry.sendEvent("packageDeltaTask");
    }
  );
  let cmdTaskDeploy = vscode.commands.registerCommand(
    "oradew.deployTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "oradew: deploy"
      );
      Telemetry.sendEvent("deployTask");
    }
  );
  let cmdTaskDeployFile = vscode.commands.registerCommand(
    "oradew.deployTaskFile",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "oradew: deploy--file"
      );
      Telemetry.sendEvent("deployTaskFile");
    }
  );
  let cmdTaskTest = vscode.commands.registerCommand("oradew.testTask", () => {
    vscode.commands.executeCommand(
      "workbench.action.tasks.runTask",
      "oradew: test"
    );
    Telemetry.sendEvent("testTask");
  });
  let taskExec: Thenable<vscode.TaskExecution>;
  let cmdTaskCompileOnSave = vscode.commands.registerCommand(
    "oradew.compileOnSaveTask",
    () => {
      // Get our task from active executions (terminate doesn't delete from taskexecution!)
      // let taskExec = vscode.tasks.taskExecutions.filter(
      //   t => t.task.name === "compileOnSave"
      // )[0];
      // If if doesn't exist - execute, otherwise terminate.
      if (!taskExec) {
        let _task = createCompileOnSaveTask();
        taskExec = vscode.tasks.executeTask(_task);
      } else {
        taskExec.then(task => task.terminate());
        taskExec = null;
      }
      Telemetry.sendEvent("compileOnSaveTask");
    }
  );

  context.subscriptions.push(cmdTaskGenerate);
  context.subscriptions.push(cmdTaskInitProject);
  context.subscriptions.push(cmdTaskCreateProject);
  context.subscriptions.push(cmdTaskCompile);
  context.subscriptions.push(cmdTaskCompileAll);
  context.subscriptions.push(cmdTaskCompileFile);
  context.subscriptions.push(cmdTaskCompileObject);
  context.subscriptions.push(cmdTaskExport);
  context.subscriptions.push(cmdTaskExportFile);
  context.subscriptions.push(cmdTaskExportObject);
  context.subscriptions.push(cmdTaskPackage);
  context.subscriptions.push(cmdTaskPackageDelta);
  context.subscriptions.push(cmdTaskDeploy);
  context.subscriptions.push(cmdTaskDeployFile);
  context.subscriptions.push(cmdTaskTest);
  context.subscriptions.push(cmdTaskCompileOnSave);

  // Internal
  context.subscriptions.push(cmdGetEnvironment);
  context.subscriptions.push(cmdPickEnvironment);
  context.subscriptions.push(cmdGetGeneratorFunction);

  context.subscriptions.push(cmdSetDbEnvironment);
  context.subscriptions.push(cmdClearDbEnvironment);

  // Telemetry
  context.subscriptions.push(Telemetry.reporter);
}

// this method is called when your extension is deactivated
export function deactivate(): void {
  if (oradewTaskProvider) {
    oradewTaskProvider.dispose();
  }
  if (environmentController) {
    environmentController.dispose();
  }
  Telemetry.deactivate();
}
