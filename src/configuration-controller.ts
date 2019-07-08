import { workspace } from "vscode";
import { resolve } from "path";

export class ConfigurationController {
  public databaseConfigFile: string;
  public workspaceConfigFile: string;
  public generatorConfigFile: string;
  public chatty: boolean;

  private static _instance: ConfigurationController;

  public static getInstance(): ConfigurationController {
    if (!ConfigurationController._instance) {
      ConfigurationController._instance = new ConfigurationController();
    }

    return ConfigurationController._instance;
  }

  private constructor() {
    this.initializeSettings();
  }

  initializeSettings() {
    const oradewConfiguration = workspace.getConfiguration("oradew");
    const workspacePath = workspace.workspaceFolders![0].uri.fsPath || "";

    const configParamWsConfigPath: string = oradewConfiguration.get(
      "workspaceConfigFile"
    );
    this.workspaceConfigFile = resolve(
      configParamWsConfigPath.replace("${workspaceFolder}", workspacePath)
    );

    const configParamDbConfigPath: string = oradewConfiguration.get(
      "databaseConfigFile"
    );
    this.databaseConfigFile = resolve(
      configParamDbConfigPath.replace("${workspaceFolder}", workspacePath)
    );

    const configParamGeneratorPath: string = oradewConfiguration.get(
      "generatorConfigFile"
    );
    this.generatorConfigFile = resolve(
      configParamGeneratorPath.replace("${workspaceFolder}", workspacePath)
    );

    this.chatty = oradewConfiguration.get("chatty");
  }
}
