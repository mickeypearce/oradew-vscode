import { window, commands } from "vscode";
import { sync as commandExists } from "command-exists";
import { existsSync } from "fs-extra";
import { ConfigurationController } from "./configuration-controller";

let settings = ConfigurationController.getInstance();

// Git and NodeJS are mandatory prerequsites, SQl*Plus is a warning only
export const existPrerequisites = (): boolean => {
  let bCheck = true;
  if (!commandExists("git")) {
    window.showErrorMessage(`Oradew: "git" command (Git) is required in command-line.`);
    bCheck = false;
  }
  if (!commandExists("node")) {
    window.showErrorMessage(`Oradew: "node" command (Node.js) is required in command-line.`);
    bCheck = false;
  }
  // Optional - SQL*Plus or SQLcl is required only for certain oradew commands
  if (!commandExists("sqlplus") && !commandExists("sql")) {
    window.showWarningMessage(
      `Oradew: "sqlplus" (SQL*Plus) or "sql" (SQLcl) command is required in command-line for certain commands.`
    );
  }
  return bCheck;
};

// Set context variable which is then used to enable keybindings, context menus in package.json..
export const setInitialized = () => {
  // Existing dbConfigPath is extension activation point, together with prerequisites
  if (existsSync(settings.databaseConfigFile) && existPrerequisites()) {
    commands.executeCommand("setContext", "inOradewProject", true);
  } else {
    commands.executeCommand("setContext", "inOradewProject", false);
  }
};
