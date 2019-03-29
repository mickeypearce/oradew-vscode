"use strict";

import * as vscode from "vscode";

import { resolve } from "path";
import { readJson, existsSync } from "fs-extra";

import { TaskManager } from "./task-manager";
import { GeneratorManager } from "./generator-manager";

let taskProvider: vscode.Disposable | undefined;

// Enviroment where tasks are executed
let defaultEnv: string | null = "DEV";

let statusBar = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Left,
  10
);

const updateStatusBar = () => {
  statusBar.tooltip = "Oradew: Set DB Environment";
  statusBar.command = `oradew.selectDefEnv`;
  statusBar.text = `$(gear) ${defaultEnv}`;
  statusBar.show();
};

const initExtension = () => {
  // Variable is then used in package.json to enable bookmarks...
  vscode.commands.executeCommand("setContext", "inOradewProject", true);
  updateStatusBar();
};

export function activate(context: vscode.ExtensionContext) {
  const workspacePath =
    vscode.workspace.workspaceFolders![0].uri.fsPath || context.extensionPath;
  const contextPath = context.extensionPath;
  const storagePath = context.storagePath || context.extensionPath;

  // Reactive extension when settings.json changes as databaseConfigPath file
  // which is activation trigger can be defined in settings
  vscode.workspace.onDidChangeConfiguration(() => {
    activate(context);
  });

  // Oradew configurations
  const configParamChatty: boolean = vscode.workspace
    .getConfiguration("oradew")
    .get("chatty");

  const isSilent = !configParamChatty;

  const configParamWsConfigPath: string = vscode.workspace
    .getConfiguration("oradew")
    .get("workspaceConfigFile");

  const wsConfigPath = resolve(
    configParamWsConfigPath.replace("${workspaceFolder}", workspacePath)
  );

  const configParamDbConfigPath: string = vscode.workspace
    .getConfiguration("oradew")
    .get("databaseConfigFile");

  const dbConfigPath = resolve(
    configParamDbConfigPath.replace("${workspaceFolder}", workspacePath)
  );

  // Esisting DbConfigPath is ext activation point
  if (existsSync(dbConfigPath)) {
    initExtension();
  }

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
              "${command:oradew.listEnv}",
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
        params: ["create", "--env", "${command:oradew.listEnv}"]
      })
    );

    result.push(
      createOradewTask({
        name: "compile",
        params: [
          "compile",
          "--env",
          "${command:oradew.listEnv}",
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
          "${command:oradew.listEnv}",
          "--file",
          "${file}"
        ]
      })
    );

    result.push(
      createOradewTask({
        name: "compile--all",
        params: ["compile", "--env", "${command:oradew.listEnv}"]
      })
    );

    result.push(
      createOradewTask({
        name: "compile--object",
        params: [
          "compile",
          "--env",
          "${command:oradew.listEnv}",
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
          "${command:oradew.listEnv}",
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
          "${command:oradew.listEnv}",
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
          "${command:oradew.listEnv}",
          "--object",
          "${selectedText}"
        ]
      })
    );

    result.push(
      createOradewTask({
        name: "package",
        params: ["package", "--env", "${command:oradew.listEnv}"]
      })
    );

    result.push(
      createOradewTask({
        name: "package--changes",
        params: ["package", "--env", "${command:oradew.listEnv}", "--changed"]
      })
    );

    result.push(
      createOradewTask({
        name: "deploy",
        params: ["run", "--env", "${command:oradew.listEnvAlways}"]
      })
    );

    result.push(
      createOradewTask({
        name: "deploy--file",
        params: [
          "run",
          "--env",
          "${command:oradew.listEnv}",
          "--file",
          "${file}"
        ]
      })
    );

    result.push(
      createOradewTask({
        name: "test",
        params: ["test", "--env", "${command:oradew.listEnv}"]
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

  const createEnvList = (config): vscode.QuickPickItem[] => {
    return Object.keys(config).reduce((acc, value) => {
      return [
        ...acc,
        {
          label: value,
          description: config[value].connectString,
          picked: defaultEnv === value
        }
      ];
    }, []);
  };

  const listEnv = (): Thenable<string | null> => {
    return readJson(dbConfigPath)
      .then(config => {
        let options: vscode.QuickPickOptions = {
          placeHolder: "Pick DB environment to execute to",
          matchOnDescription: true,
          matchOnDetail: true
        };
        let envs: vscode.QuickPickItem[] = createEnvList(config);

        if (defaultEnv === "<None>") {
          return vscode.window
            .showQuickPick(envs, options)
            .then(item => (item ? item.label : null));
        } else {
          return defaultEnv;
        }
      })
      .catch(err => {
        return vscode.window
          .showErrorMessage(`Environment picker failed: ${err.message}`)
          .then(_ => null);
      });
  };

  const listEnvAlways = (addNoneOption?: boolean): Thenable<string | null> => {
    return readJson(dbConfigPath)
      .then(config => {
        let options: vscode.QuickPickOptions = {
          placeHolder: "Pick DB environment",
          matchOnDescription: true,
          matchOnDetail: true
        };
        let envs: vscode.QuickPickItem[] = createEnvList(config);
        if (addNoneOption === true) {
          envs.push({
            label: "<None>",
            description: "Select environment when executing command"
          });
        }
        return vscode.window
          .showQuickPick(envs, options)
          .then(item => (item ? item.label : null));
      })
      .catch(err => {
        return vscode.window
          .showErrorMessage(`Environment picker failed: ${err.message}`, {
            modal: true
          })
          .then(_ => null);
      });
  };

  const selectDefEnv = async (): Promise<void> => {
    const pickEnv = await listEnvAlways(true);
    if (pickEnv) {
      defaultEnv = pickEnv;
      updateStatusBar();
    }
  };

  // In task command exucution
  let cmdListEnv = vscode.commands.registerCommand("oradew.listEnv", listEnv);
  // Used for deploy task command
  let cmdListEnvAlways = vscode.commands.registerCommand(
    "oradew.listEnvAlways",
    listEnvAlways
  );
  // Select DB environment command
  let cmdSelectDefEnv = vscode.commands.registerCommand(
    "oradew.selectDefEnv",
    selectDefEnv
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
  let cmdTaskPackageChanges = vscode.commands.registerCommand(
    "oradew.packageChangesTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: package--changes"
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
    //   params: ["test", "--env", "${command:oradew.listEnv}"],
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
          params: ["compileOnSave", "--env", "${command:oradew.listEnv}"]
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
  context.subscriptions.push(cmdTaskPackageChanges);
  context.subscriptions.push(cmdTaskDeploy);
  context.subscriptions.push(cmdTaskDeployFile);
  context.subscriptions.push(cmdTaskTest);
  context.subscriptions.push(cmdTaskCompileOnSave);

  context.subscriptions.push(cmdListEnv);
  context.subscriptions.push(cmdListEnvAlways);
  context.subscriptions.push(cmdSelectDefEnv);
}

// this method is called when your extension is deactivated
export function deactivate(): void {
  if (taskProvider) {
    taskProvider.dispose();
  }
}
