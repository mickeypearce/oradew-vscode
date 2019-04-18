"use strict";

import * as vscode from "vscode";

import { existsSync } from "fs-extra";

import { TaskManager } from "./task-manager";
import { GeneratorManager } from "./generator-manager";
import { EnvironmentController } from "./environment-controller";
import { ConfigurationController } from "./configuration-controller";

let taskProvider: vscode.Disposable | undefined;
let environmentController: EnvironmentController;

const initExtension = () => {
  // Variable is then used in package.json to enable bookmarks...
  vscode.commands.executeCommand("setContext", "inOradewProject", true);
};

export function activate(context: vscode.ExtensionContext) {
  const workspacePath =
    vscode.workspace.workspaceFolders![0].uri.fsPath || context.extensionPath;
  const contextPath = context.extensionPath;
  const storagePath = context.storagePath || context.extensionPath;

  let settings = ConfigurationController.getInstance();
  const isSilent = !settings.chatty;
  const wsConfigPath = settings.workspaceConfigFile;
  const dbConfigPath = settings.databaseConfigFile;

  // let watcher = vscode.workspace.createFileSystemWatcher(dbConfigPath);
  // watcher.onDidCreate(() => {
  //   activate(context);
  // });

  // Existing DbConfigPath is ext activation point
  if (existsSync(dbConfigPath)) {
    initExtension();
  }

  // Reactivate extension when settings.json changes as databaseConfigPath file
  // which is activation trigger can be defined in settings
  vscode.workspace.onDidChangeConfiguration(() => {
    deactivate();
    activate(context);
  });

  const taskManager = new TaskManager({
    workspacePath,
    contextPath,
    storagePath,
    dbConfigPath,
    wsConfigPath,
    isSilent,
    isColor: true
  });

  const generatorManager = new GeneratorManager();
  environmentController = new EnvironmentController();

  const createOradewTask = ({
    name,
    params
  }: {
    name: string;
    params: Array<string>;
  }) => {
    let _task = new vscode.Task(
      { type: "shell", name },
      vscode.TaskScope.Workspace,
      name,
      "Oradew",
      new vscode.ProcessExecution(
        "node",
        [...taskManager.gulpParams, ...params],
        taskManager.processEnv
      ),
      "$oracle-plsql"
    );
    return _task;
  };

  function getTasks(): vscode.Task[] {
    let result: vscode.Task[] = [];

    // Register generators as tasks
    for (let generator of generatorManager.getDefinitions()) {
      if (generator.label && generator.function) {
        result.push(
          createOradewTask({
            name: "generator." + generator.label,
            params: [
              "generate",
              "--env",
              "${command:oradew.getEnvironment}",
              "--func",
              generator.function,
              "--file",
              "${file}",
              "--object",
              "${selectedText}",
              ...(generator.output ? ["--output", generator.output] : [])
            ]
          })
        );
      }
    }

    result.push(
      createOradewTask({
        name: "init",
        params: ["init", "--prompt", "true"]
      })
    );

    result.push(
      createOradewTask({
        name: "create",
        params: ["create", "--env", "${command:oradew.getEnvironment}"]
      })
    );

    result.push(
      createOradewTask({
        name: "compile",
        params: [
          "compile",
          "--env",
          "${command:oradew.getEnvironment}",
          "--changed",
          "true"
        ]
      })
    );

    result.push(
      createOradewTask({
        name: "compile--file",
        params: [
          "compile",
          "--env",
          "${command:oradew.getEnvironment}",
          "--file",
          "${file}"
        ]
      })
    );

    result.push(
      createOradewTask({
        name: "compile--all",
        params: ["compile", "--env", "${command:oradew.getEnvironment}"]
      })
    );

    result.push(
      createOradewTask({
        name: "compile--object",
        params: [
          "compile",
          "--env",
          "${command:oradew.getEnvironment}",
          "--file",
          "${file}",
          "--object",
          "${selectedText}",
          "--line",
          "${lineNumber}"
        ]
      })
    );

    result.push(
      createOradewTask({
        name: "export",
        params: [
          "import",
          "--env",
          "${command:oradew.getEnvironment}",
          "--ease",
          "true"
        ]
      })
    );

    result.push(
      createOradewTask({
        name: "export--file",
        params: [
          "import",
          "--env",
          "${command:oradew.getEnvironment}",
          "--file",
          "${file}"
        ]
      })
    );

    result.push(
      createOradewTask({
        name: "export--object",
        params: [
          "import",
          "--env",
          "${command:oradew.getEnvironment}",
          "--object",
          "${selectedText}"
        ]
      })
    );

    result.push(
      createOradewTask({
        name: "package",
        params: ["package", "--env", "${command:oradew.getEnvironment}"]
      })
    );

    result.push(
      createOradewTask({
        name: "package--delta",
        params: [
          "package",
          "--env",
          "${command:oradew.getEnvironment}",
          "--delta"
        ]
      })
    );

    result.push(
      createOradewTask({
        name: "deploy",
        params: ["run", "--env", "${command:oradew.pickEnvironment}"]
      })
    );

    result.push(
      createOradewTask({
        name: "deploy--file",
        params: [
          "run",
          "--env",
          "${command:oradew.getEnvironment}",
          "--file",
          "${file}"
        ]
      })
    );

    result.push(
      createOradewTask({
        name: "test",
        params: ["test", "--env", "${command:oradew.getEnvironment}"]
      })
    );

    return result;
  }

  /* ***********/

  let registerOradewTasks = () => {
    let tasks: vscode.Task[] = [];
    taskProvider = vscode.tasks.registerTaskProvider("gulp", {
      provideTasks: () => {
        if (tasks.length === 0) {
          tasks = getTasks();
        }
        return tasks;
      },
      resolveTask(_task: vscode.Task): vscode.Task | undefined {
        return undefined;
      }
    });
  };

  registerOradewTasks();

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

  let cmdTaskGenerate = vscode.commands.registerCommand(
    "oradew.generateTask",
    async () => {
      // Reload registering of generators
      registerOradewTasks();
      let generator = await vscode.window.showQuickPick(
        generatorManager.getDefinitions()
      );
      if (generator && generator.label && generator.function) {
        vscode.commands.executeCommand(
          "workbench.action.tasks.runTask",
          "Oradew: generator." + generator.label
        );
      }
    }
  );
  /************** */
  let cmdTaskInitProject = vscode.commands.registerCommand(
    "oradew.initProjectTask",
    async () => {
      await vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: init"
      );
      initExtension();
    }
  );
  let cmdTaskCreateProject = vscode.commands.registerCommand(
    "oradew.createProjectTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: create"
      );
    }
  );
  let cmdTaskCompile = vscode.commands.registerCommand(
    "oradew.compileTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: compile"
      );
    }
  );
  let cmdTaskCompileAll = vscode.commands.registerCommand(
    "oradew.compileAllTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: compile--all"
      );
    }
  );
  let cmdTaskCompileFile = vscode.commands.registerCommand(
    "oradew.compileFileTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: compile--file"
      );
    }
  );
  let cmdTaskCompileObject = vscode.commands.registerCommand(
    "oradew.compileObjectTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: compile--object"
      );
    }
  );
  let cmdTaskExport = vscode.commands.registerCommand(
    "oradew.exportTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: export"
      );
    }
  );
  let cmdTaskExportFile = vscode.commands.registerCommand(
    "oradew.exportFileTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: export--file"
      );
    }
  );
  let cmdTaskExportObject = vscode.commands.registerCommand(
    "oradew.exportObjectTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: export--object"
      );
    }
  );
  let cmdTaskPackage = vscode.commands.registerCommand(
    "oradew.packageTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: package"
      );
    }
  );
  let cmdTaskPackageDelta = vscode.commands.registerCommand(
    "oradew.packageDeltaTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: package--delta"
      );
    }
  );
  let cmdTaskDeploy = vscode.commands.registerCommand(
    "oradew.deployTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: deploy"
      );
    }
  );
  let cmdTaskDeployFile = vscode.commands.registerCommand(
    "oradew.deployTaskFile",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: deploy--file"
      );
    }
  );
  let cmdTaskTest = vscode.commands.registerCommand("oradew.testTask", () => {
    vscode.commands.executeCommand(
      "workbench.action.tasks.runTask",
      "Oradew: test"
    );
    // let _task = createOradewTask({
    //   name: "test",
    //   params: ["test", "--env", "${command:oradew.getEnvironment}"],
    //   isBackground: false
    // });
    // vscode.tasks.executeTask(_task);
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
        let _task = createOradewTask({
          name: "compileOnSave",
          params: ["compileOnSave", "--env", "${command:oradew.getEnvironment}"]
        });
        _task.isBackground = true;
        _task.presentationOptions = {
          reveal: vscode.TaskRevealKind.Silent
        };
        taskExec = vscode.tasks.executeTask(_task);
      } else {
        taskExec.then(task => task.terminate());
        taskExec = null;
      }
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

  context.subscriptions.push(cmdSetDbEnvironment);
  context.subscriptions.push(cmdClearDbEnvironment);
}

// this method is called when your extension is deactivated
export function deactivate(): void {
  if (taskProvider) {
    taskProvider.dispose();
  }
  if (environmentController) {
    environmentController.dispose();
  }
}
