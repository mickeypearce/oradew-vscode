"use strict";

import * as vscode from "vscode";

let taskProvider: vscode.Disposable | undefined;

export function activate(context: vscode.ExtensionContext) {
  const isSilent = (process.env["silent"] || "true") === "true";

  let rootPath =
    vscode.workspace.workspaceFolders![0].uri.fsPath || context.extensionPath;
  if (rootPath.includes(" ")) {
    // Why it doesnt work with " on powershell as default terminal?
    rootPath = `"${rootPath}"`;
  }

  const storagePath = context.storagePath || context.extensionPath;

  function getTasks(): vscode.Task[] {
    let result: vscode.Task[] = [];

    const gulpPath = context.asAbsolutePath("out/gulp.cmd");
    const gulpPathJs = context.asAbsolutePath("node_modules/gulp/bin/gulp.js");
    const gulpFile = context.asAbsolutePath("out/gulpfile.js");
    let gulpShell = `${gulpPath} --cwd ${rootPath} --gulpfile ${gulpFile} --color true`;
    if (isSilent) {
      gulpShell = `${gulpShell} --silent true`;
    }
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

    result.push(
      new vscode.Task(
        { type: "gulp", name: "init" },
        "init",
        "Oradew",
        new vscode.ShellExecution(
          `${gulpShell}` + " initProject",
          shellOptions
        ),
        "$oracle-plsql"
      )
    );

    result.push(
      new vscode.Task(
        { type: "gulp", name: "create" },
        "create",
        "Oradew",
        new vscode.ShellExecution(
          `${gulpShell}` + ' createProject --env "DEV"',
          shellOptions
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
            ' compileAndMergeFilesToDb --env "DEV" --changed true',
          shellOptions
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
            ' compileAndMergeFilesToDb --env "DEV" --file "${file}"',
          shellOptions
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
            ' compileAndMergeFilesToDb --env "TEST" --file "${file}" --force true',
          shellOptions
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
          `${gulpShell}` + ' compileAndMergeFilesToDb --env "DEV"',
          shellOptions
        ),
        "$oracle-plsql"
      )
    );

    // new vscode.ShellExecution(
    //   `${gulpShell}` +
    //     ' compileObjectToDb --env "DEV" --file "${file}" --line ${lineNumber}',
    //   // ' compileObjectToDb --env "DEV" --file "${file}" --object="${selectedText}" --line ${lineNumber}',
    //   { shellArgs: ["--object", "${selectedText}"] }
    // ),

    result.push(
      new vscode.Task(
        { type: "gulp", name: "compile--object" },
        "compile--object",
        "Oradew",
        new vscode.ShellExecution(
          // `${gulpPath}`,
          "node",
          [
            // `${gulpPathJs}`,
            // "--cwd",
            // `${rootPath}`,
            // "--gulpfile",
            // `${gulpFile}`,
            // "--color",
            // "true",
            ...gulpParams,
            "compileObjectToDb",
            "--env",
            "DEV",
            "--file",
            "${file}",
            "--object",
            // "${selectedText}",
            {
              value: "${selectedText}",
              //               value: `COMMENT ON COLUMN nkap.pkp_informativni_izracun.vodilniUkrepRestrukturiranja IS
              // \`'Šifra vodilni ukrep restrukturiranja izbran iz šifranta ukrepov\`'`,
              quoting: 1
            },
            "--line",
            "${lineNumber}"
          ],
          // ' compileObjectToDb --env "DEV" --file "${file}" --line ${lineNumber}',
          // `${gulpShell}` +
          //   ' compileObjectToDb --env "DEV" --file "${file}" --object="${selectedText}" --line ${lineNumber}',
          {
            //   // shellArgs: [
            //   //   "--object",
            //   //   `select 1 sifra_ukrepa, NAZIV_UKREPA, status\n from sifranti.SFRV_RSTRUKREPI`
            // ],
            shellQuoting: {
              escape: { charsToEscape: " \n\r", escapeChar: "`" },
              // escape: "a",
              // escape: { escapeChar: "a", charsToEscape: `\r\n` }
              strong: "b",
              weak: "c"
            }
          }
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
          `${gulpShell}` + ' exportFilesFromDb --env "DEV" --ease true',
          shellOptions
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
          `${gulpShell}` + ' exportFilesFromDb --env "DEV" --file "${file}"',
          shellOptions
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
          `${gulpShell}` + ' exportFilesFromDb --env "TEST" --file "${file}"',
          shellOptions
        ),
        "$oracle-plsql"
      )
    );

    result.push(
      new vscode.Task(
        { type: "gulp", name: "export--object" },
        "export--object",
        "Oradew",
        new vscode.ShellExecution(
          `${gulpShell}` +
            ' importObjectFromDb --env "DEV" --object "${selectedText}"',
          shellOptions
        ),
        "$oracle-plsql"
      )
    );

    result.push(
      new vscode.Task(
        { type: "gulp", name: "package" },
        "package",
        "Oradew",
        new vscode.ShellExecution(`${gulpShell} packageSrc`, shellOptions),
        "$oracle-plsql"
      )
    );

    result.push(
      new vscode.Task(
        { type: "gulp", name: "populateChanges" },
        "populateChanges",
        "Oradew",
        new vscode.ShellExecution(
          `${gulpShell} createDeployInputFromGit`,
          shellOptions
        ),
        "$oracle-plsql"
      )
    );

    result.push(
      new vscode.Task(
        { type: "gulp", name: "deploy:TEST" },
        "deploy:TEST",
        "Oradew",
        new vscode.ShellExecution(
          `${gulpShell}` + ' deployFilesToDb --env "TEST"',
          shellOptions
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
          `${gulpShell}` + ' deployFilesToDb --env "UAT"',
          shellOptions
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
          `${gulpShell}` + ' deployFilesToDb --env "DEV" --file "${file}"',
          shellOptions
        ),
        "$oracle-plsql"
      )
    );

    result.push(
      new vscode.Task(
        { type: "gulp", name: "runTest" },
        "runTest",
        "Oradew",
        new vscode.ShellExecution(`${gulpShell}` + " runTest", shellOptions),
        "$oracle-plsql"
      )
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
