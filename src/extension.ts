"use strict";

import * as vscode from "vscode";

let taskProvider: vscode.Disposable | undefined;

export function activate(context: vscode.ExtensionContext) {
  const rootPath = vscode.workspace.rootPath || context.extensionPath;

  function getTasks(): vscode.Task[] {
    let result: vscode.Task[] = [];

    const gulpPath = context.asAbsolutePath("out\\gulp.cmd");
    const gulpFile = context.asAbsolutePath("out\\gulpfile.js");
    const gulpShell = `${gulpPath} --cwd ${rootPath} --gulpfile ${gulpFile} --silent true --color true`;
    // const gulpShell = `${gulpPath} --cwd ${rootPath} --gulpfile ${gulpFile}`;

    result.push(
      new vscode.Task(
        { type: "gulp", name: "init" },
        "init",
        "Oradew",
        new vscode.ShellExecution(`${gulpShell}` + " initProject"),
        "$oracle-plsql"
      )
    );

    result.push(
      new vscode.Task(
        { type: "gulp", name: "create" },
        "create",
        "Oradew",
        new vscode.ShellExecution(
          `${gulpShell}` + ' createProject --env "DEV"'
        ),
        "$oracle-plsql"
      )
    );

    result.push(
      new vscode.Task(
        { type: "gulp", name: "compile" },
        "compile",
        "Oradew",
        new vscode.ShellExecution(
          `${gulpShell}` +
            ' compileAndMergeFilesToDb --env "DEV" --changed true'
        ),
        "$oracle-plsql"
      )
    );

    result.push(
      new vscode.Task(
        { type: "gulp", name: "compile--file" },
        "compile--file",
        "Oradew",
        new vscode.ShellExecution(
          `${gulpShell}` +
            ' compileAndMergeFilesToDb --env "DEV" --file ${file}'
        ),
        "$oracle-plsql"
      )
    );

    result.push(
      new vscode.Task(
        { type: "gulp", name: "compile--file:TEST" },
        "compile--file:TEST",
        "Oradew",
        new vscode.ShellExecution(
          `${gulpShell}` +
            ' compileAndMergeFilesToDb --env "TEST" --file ${file} --force true'
        ),
        "$oracle-plsql"
      )
    );

    result.push(
      new vscode.Task(
        { type: "gulp", name: "compile--all" },
        "compile--all",
        "Oradew",
        new vscode.ShellExecution(
          `${gulpShell}` + ' compileAndMergeFilesToDb --env "DEV"'
        ),
        "$oracle-plsql"
      )
    );

    result.push(
      new vscode.Task(
        { type: "gulp", name: "export" },
        "export",
        "Oradew",
        new vscode.ShellExecution(
          `${gulpShell}` + ' exportFilesFromDb --env "DEV" --ease true'
        ),
        "$oracle-plsql"
      )
    );

    result.push(
      new vscode.Task(
        { type: "gulp", name: "export--file" },
        "export--file",
        "Oradew",
        new vscode.ShellExecution(
          `${gulpShell}` + ' exportFilesFromDb --env "DEV" --file ${file}'
        ),
        "$oracle-plsql"
      )
    );

    result.push(
      new vscode.Task(
        { type: "gulp", name: "export--file:TEST" },
        "export--file:TEST",
        "Oradew",
        new vscode.ShellExecution(
          `${gulpShell}` + ' exportFilesFromDb --env "TEST" --file ${file}'
        ),
        "$oracle-plsql"
      )
    );

    result.push(
      new vscode.Task(
        { type: "gulp", name: "package" },
        "package",
        "Oradew",
        new vscode.ShellExecution(`${gulpShell} packageSrc`),
        "$oracle-plsql"
      )
    );

    result.push(
      new vscode.Task(
        { type: "gulp", name: "deploy:TEST" },
        "deploy:TEST",
        "Oradew",
        new vscode.ShellExecution(
          `${gulpShell}` + ' deployFilesToDb --env "TEST"'
        ),
        "$oracle-plsql"
      )
    );

    result.push(
      new vscode.Task(
        { type: "gulp", name: "deploy:UAT" },
        "deploy:UAT",
        "Oradew",
        new vscode.ShellExecution(
          `${gulpShell}` + ' deployFilesToDb --env "UAT"'
        ),
        "$oracle-plsql"
      )
    );

    result.push(
      new vscode.Task(
        { type: "gulp", name: "deploy--file" },
        "deploy--file",
        "Oradew",
        new vscode.ShellExecution(
          `${gulpShell}` + ' deployFilesToDb --env "DEV" --file ${file}'
        ),
        "$oracle-plsql"
      )
    );

    result.push(
      new vscode.Task(
        { type: "gulp", name: "runTest" },
        "runTest",
        "Oradew",
        new vscode.ShellExecution(`${gulpShell}` + " runTest"),
        "$oracle-plsql"
      )
    );

    return result;
  }

  /* ***********/

  let tasks: vscode.Task[] = [];
  taskProvider = vscode.workspace.registerTaskProvider("gulp", {
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
  let cmdTaskPackage = vscode.commands.registerCommand(
    "oradew.packageTask",
    () => {
      vscode.commands.executeCommand(
        "workbench.action.tasks.runTask",
        "Oradew: package"
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
  context.subscriptions.push(cmdTaskExport);
  context.subscriptions.push(cmdTaskExportFile);
  context.subscriptions.push(cmdTaskExportFileTest);
  context.subscriptions.push(cmdTaskPackage);
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
