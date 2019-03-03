"use strict";

import * as vscode from "vscode";

const { resolve } = require("path");

const { readJsonSync, existsSync } = require("fs-extra");

import { TaskManager } from "./task-manager";
import { GeneratorManager } from "./generator-manager";

let taskProvider: vscode.Disposable | undefined;
let defaultEnv: string | null = 'DEV';

export function activate(context: vscode.ExtensionContext) {
  vscode.commands.executeCommand("setContext", "inOradewProject", true);

  const workspacePath =
    vscode.workspace.workspaceFolders![0].uri.fsPath || context.extensionPath;
  const contextPath = context.extensionPath;
  const storagePath = context.storagePath || context.extensionPath;
  const isSilent = (process.env.silent || "true") === "true";

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

  if (!existsSync(dbConfigPath)) return;


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
    return new vscode.Task(
      { type: "gulp", name },
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
              "DEV",
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
        params: ["initWorkspace", "--prompt", "true"]
      })
    );

    result.push(
      createOradewTask({
        name: "create",
        params: ["createSource", "--env", "DEV"]
      })
    );

    result.push(
      createOradewTask({
        name: "compile",
        params: ["compileFiles", "--env", "DEV", "--changed", "true"]
      })
    );

    result.push(
      createOradewTask({
        name: "compile--file",
        params: ["compileFiles", "--env", "${command:oradew.listEnv}", "--file", "${file}"]
      })
    );

    result.push(
      createOradewTask({
        name: "compile--file:TEST",
        params: [
          "compileFiles",
          "--env",
          "TEST",
          "--file",
          "${file}",
          "--force",
          "true"
        ]
      })
    );

    result.push(
      createOradewTask({
        name: "compile--file:UAT",
        params: [
          "compileFiles",
          "--env",
          "UAT",
          "--file",
          "${file}",
          "--force",
          "true"
        ]
      })
    );

    result.push(
      createOradewTask({
        name: "compile--all",
        params: ["compileFiles", "--env", "DEV"]
      })
    );

    result.push(
      createOradewTask({
        name: "compile--object",
        params: [
          "compileObject",
          "--env",
          "DEV",
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
        name: "compile--object:TEST",
        params: [
          "compileObject",
          "--env",
          "TEST",
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
        name: "compile--object:UAT",
        params: [
          "compileObject",
          "--env",
          "UAT",
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
        params: ["importFiles", "--env", "DEV", "--ease", "true"]
      })
    );

    result.push(
      createOradewTask({
        name: "export--file",
        params: ["importFiles", "--env", "DEV", "--file", "${file}"]
      })
    );

    result.push(
      createOradewTask({
        name: "export--file:TEST",
        params: ["importFiles", "--env", "TEST", "--file", "${file}"]
      })
    );

    result.push(
      createOradewTask({
        name: "export--object",
        params: ["importObject", "--env", "DEV", "--object", "${selectedText}"]
      })
    );

    result.push(
      createOradewTask({
        name: "package",
        params: ["package", "--env", "DEV"]
      })
    );

    result.push(
      createOradewTask({
        name: "package:TEST",
        params: ["package", "--env", "TEST"]
      })
    );

    result.push(
      createOradewTask({
        name: "package:UAT",
        params: ["package", "--env", "UAT"]
      })
    );

    result.push(
      createOradewTask({
        name: "populateChanges",
        params: ["createDeployInputFromGit"]
      })
    );

    result.push(
      createOradewTask({
        name: "deploy:TEST",
        params: ["runFile", "--env", "${command:oradew.listEnv}"]
      })
    );

    result.push(
      createOradewTask({
        name: "deploy:UAT",
        params: ["runFile", "--env", "UAT"]
      })
    );

    result.push(
      createOradewTask({
        name: "deploy--file",
        params: ["runFile", "--env", "DEV", "--file", "${file}"]
      })
    );

    result.push(
      createOradewTask({
        name: "deploy--file:TEST",
        params: ["runFile", "--env", "TEST", "--file", "${file}"]
      })
    );

    result.push(
      createOradewTask({
        name: "runTest",
        params: ["runTest"]
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

  const listEnv = (none?: boolean): Thenable<string | null> => {

    return new Promise(async function (resolve, reject) {
      // return readJson(dbConfigPath, { throws: false }).then(config => {
      // console.log(config);
      // return listProcesses(ports).then(items => {
      let options: vscode.QuickPickOptions = {
        placeHolder: "Pick DB environment to execute to",
        matchOnDescription: true,
        matchOnDetail: true
      };
      const config = await readJsonSync(dbConfigPath);// require(dbConfigPath);
      let envs = Object.keys(config);

      if (none === true) {
        envs.push("NONE");
        return vscode.window.showQuickPick(envs, options)
          .then(item => resolve(item));
      } else if (defaultEnv === "NONE") {
        return vscode.window.showQuickPick(envs, options)
          .then(item => resolve(item));
      } else
        return resolve(defaultEnv);
    }).catch(err => {
      return vscode.window.showErrorMessage(
        "Environment picker failed", { modal: true }).then(_ => null);
    });
  }

  const selectDefEnv = async (): Promise<void> => {
    const defaultEnv1 = await listEnv(true);
    console.log("ddd" + defaultEnv1);
    defaultEnv = defaultEnv1;
  };

  let cmdListEnv = vscode.commands.registerCommand("oradew.listEnv", listEnv);
  let cmdSelectDefEnv = vscode.commands.registerCommand("oradew.selectDefEnv", selectDefEnv);

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
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: init"
      );
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
  let cmdTaskCompileFileTest = vscode.commands.registerCommand(
    "oradew.compileFileTaskTest",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: compile--file:TEST"
      );
    }
  );
  let cmdTaskCompileFileUat = vscode.commands.registerCommand(
    "oradew.compileFileTaskUat",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: compile--file:UAT"
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
  let cmdTaskCompileObjectTest = vscode.commands.registerCommand(
    "oradew.compileObjectTaskTest",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: compile--object:TEST"
      );
    }
  );
  let cmdTaskCompileObjectUat = vscode.commands.registerCommand(
    "oradew.compileObjectTaskUat",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: compile--object:UAT"
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
  let cmdTaskExportFileTest = vscode.commands.registerCommand(
    "oradew.exportFileTaskTest",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: export--file:TEST"
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
  let cmdTaskPackageTest = vscode.commands.registerCommand(
    "oradew.packageTaskTest",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: package:TEST"
      );
    }
  );
  let cmdTaskPackageUat = vscode.commands.registerCommand(
    "oradew.packageTaskUat",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: package:UAT"
      );
    }
  );
  let cmdTaskPopulateChanges = vscode.commands.registerCommand(
    "oradew.populateChangesTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: populateChanges"
      );
    }
  );
  let cmdTaskDeployTest = vscode.commands.registerCommand(
    "oradew.deployTaskTest",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: deploy:TEST"
      );
    }
  );
  let cmdTaskDeployUat = vscode.commands.registerCommand(
    "oradew.deployTaskUat",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: deploy:UAT"
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
  let cmdTaskDeployFileTest = vscode.commands.registerCommand(
    "oradew.deployTaskFileTest",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: deploy--file:TEST"
      );
    }
  );
  let cmdTaskTest = vscode.commands.registerCommand("oradew.testTask", () => {
    vscode.commands.executeCommand(
      "workbench.action.tasks.runTask",
      "Oradew: runTest"
    );
  });

  context.subscriptions.push(cmdTaskGenerate);
  context.subscriptions.push(cmdTaskInitProject);
  context.subscriptions.push(cmdTaskCreateProject);
  context.subscriptions.push(cmdTaskCompile);
  context.subscriptions.push(cmdTaskCompileAll);
  context.subscriptions.push(cmdTaskCompileFile);
  context.subscriptions.push(cmdTaskCompileFileTest);
  context.subscriptions.push(cmdTaskCompileFileUat);
  context.subscriptions.push(cmdTaskCompileObject);
  context.subscriptions.push(cmdTaskCompileObjectTest);
  context.subscriptions.push(cmdTaskCompileObjectUat);
  context.subscriptions.push(cmdTaskExport);
  context.subscriptions.push(cmdTaskExportFile);
  context.subscriptions.push(cmdTaskExportFileTest);
  context.subscriptions.push(cmdTaskExportObject);
  context.subscriptions.push(cmdTaskPackage);
  context.subscriptions.push(cmdTaskPackageTest);
  context.subscriptions.push(cmdTaskPackageUat);
  context.subscriptions.push(cmdTaskPopulateChanges);
  context.subscriptions.push(cmdTaskDeployTest);
  context.subscriptions.push(cmdTaskDeployUat);
  context.subscriptions.push(cmdTaskDeployFile);
  context.subscriptions.push(cmdTaskDeployFileTest);
  context.subscriptions.push(cmdTaskTest);

  context.subscriptions.push(cmdListEnv);
  context.subscriptions.push(cmdSelectDefEnv);
}

// this method is called when your extension is deactivated
export function deactivate(): void {
  if (taskProvider) {
    taskProvider.dispose();
  }
}
