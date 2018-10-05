"use strict";

import * as vscode from "vscode";

let taskProvider: vscode.Disposable | undefined;

export function activate(context: vscode.ExtensionContext) {
  const isSilent = (process.env["silent"] || "true") === "true";

  let rootPath =
    vscode.workspace.workspaceFolders![0].uri.fsPath || context.extensionPath;

  const storagePath = context.storagePath || context.extensionPath;

  function getTasks(): vscode.Task[] {
    let result: vscode.Task[] = [];

    const gulpPathJs = context.asAbsolutePath("node_modules/gulp/bin/gulp.js");
    const gulpFile = context.asAbsolutePath("out/gulpfile.js");

    let gulpParams = [
      `${gulpPathJs}`,
      "--cwd",
      `${rootPath}`,
      "--gulpfile",
      `${gulpFile}`,
      "--color",
      "true",
      ...(isSilent ? ["--silent", "true"] : [])
    ];

    const shellOptions = { env: { storagePath } };

    const createOradewTask = ({
      name,
      params
    }: {
      name: string;
      params: Array<string>;
    }) => {
      return new vscode.Task(
        { type: "gulp", name },
        name,
        "Oradew",
        new vscode.ProcessExecution(
          "node",
          [...gulpParams, ...params],
          shellOptions
        ),
        "$oracle-plsql"
      );
    };

    result.push(
      createOradewTask({
        name: "init",
        params: ["initProject"]
      })
    );

    result.push(
      createOradewTask({
        name: "create",
        params: ["createProject", "--env", "DEV"]
      })
    );

    result.push(
      createOradewTask({
        name: "compile",
        params: [
          "compileAndMergeFilesToDb",
          "--env",
          "DEV",
          "--changed",
          "true"
        ]
      })
    );

    result.push(
      createOradewTask({
        name: "compile--file",
        params: [
          "compileAndMergeFilesToDb",
          "--env",
          "DEV",
          "--file",
          "${file}"
        ]
      })
    );

    result.push(
      createOradewTask({
        name: "compile--file:TEST",
        params: [
          "compileAndMergeFilesToDb",
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
        name: "compile--all",
        params: ["compileAndMergeFilesToDb", "--env", "DEV"]
      })
    );

    result.push(
      createOradewTask({
        name: "compile--object",
        params: [
          "compileObjectToDb",
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
          "compileObjectToDb",
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
        name: "export",
        params: ["exportFilesFromDb", "--env", "DEV", "--ease", "true"]
      })
    );

    result.push(
      createOradewTask({
        name: "export--file",
        params: ["exportFilesFromDb", "--env", "DEV", "--file", "${file}"]
      })
    );

    result.push(
      createOradewTask({
        name: "export--file:TEST",
        params: ["exportFilesFromDb", "--env", "TEST", "--file", "${file}"]
      })
    );

    result.push(
      createOradewTask({
        name: "export--object",
        params: [
          "exportObjectFromDb",
          "--env",
          "DEV",
          "--object",
          "${selectedText}"
        ]
      })
    );

    result.push(
      createOradewTask({
        name: "package",
        params: ["packageSrc"]
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
        params: ["deployFilesToDb", "--env", "TEST"]
      })
    );

    result.push(
      createOradewTask({
        name: "deploy:UAT",
        params: ["deployFilesToDb", "--env", "UAT"]
      })
    );

    result.push(
      createOradewTask({
        name: "deploy--file",
        params: ["deployFilesToDb", "--env", "DEV", "--file", "${file}"]
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
  let cmdTaskTest = vscode.commands.registerCommand("oradew.testTask", () => {
    vscode.commands.executeCommand(
      "workbench.action.tasks.runTask",
      "Oradew: runTest"
    );
  });

  context.subscriptions.push(cmdTaskInitProject);
  context.subscriptions.push(cmdTaskCreateProject);
  context.subscriptions.push(cmdTaskCompile);
  context.subscriptions.push(cmdTaskCompileAll);
  context.subscriptions.push(cmdTaskCompileFile);
  context.subscriptions.push(cmdTaskCompileFileTest);
  context.subscriptions.push(cmdTaskCompileObject);
  context.subscriptions.push(cmdTaskCompileObjectTest);
  context.subscriptions.push(cmdTaskExport);
  context.subscriptions.push(cmdTaskExportFile);
  context.subscriptions.push(cmdTaskExportFileTest);
  context.subscriptions.push(cmdTaskExportObject);
  context.subscriptions.push(cmdTaskPackage);
  context.subscriptions.push(cmdTaskPopulateChanges);
  context.subscriptions.push(cmdTaskDeployTest);
  context.subscriptions.push(cmdTaskDeployUat);
  context.subscriptions.push(cmdTaskDeployFile);
  context.subscriptions.push(cmdTaskTest);
}

// this method is called when your extension is deactivated
export function deactivate(): void {
  if (taskProvider) {
    taskProvider.dispose();
  }
}
