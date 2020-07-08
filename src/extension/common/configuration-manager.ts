import { workspace } from "vscode";
import { resolve } from "path";

export class ConfigurationManager {
  public databaseConfigFile: string;
  public workspaceConfigFile: string;
  public generatorConfigFile: string;
  public chatty: boolean;
  public cliExecutable: string;
  public envVariables?: { [id: string]: string };
  public workspaceDir: string;

  private static _instance: ConfigurationManager;

  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager._instance) {
      ConfigurationManager._instance = new ConfigurationManager();
    }

    return ConfigurationManager._instance;
  }

  private constructor() {
    this.initializeSettings();
  }

  initializeSettings() {
    const oradewConfiguration = workspace.getConfiguration("oradew");
    this.workspaceDir = workspace.workspaceFolders ? workspace.workspaceFolders![0].uri.fsPath : "";

    const configParamWsConfigPath: string = oradewConfiguration.get("workspaceConfigFile");
    this.workspaceConfigFile = resolve(configParamWsConfigPath.replace("${workspaceFolder}", this.workspaceDir));

    const configParamDbConfigPath: string = oradewConfiguration.get("databaseConfigFile");
    this.databaseConfigFile = resolve(configParamDbConfigPath.replace("${workspaceFolder}", this.workspaceDir));

    const configParamGeneratorPath: string = oradewConfiguration.get("generatorConfigFile");
    this.generatorConfigFile = resolve(configParamGeneratorPath.replace("${workspaceFolder}", this.workspaceDir));

    this.chatty = oradewConfiguration.get("chatty");
    this.cliExecutable = oradewConfiguration.get("cliExecutable");
    this.envVariables = oradewConfiguration.get("envVariables");
  }
}
