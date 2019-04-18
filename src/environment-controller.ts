import {
  QuickPickItem,
  window,
  StatusBarAlignment,
  StatusBarItem,
  QuickPickOptions
} from "vscode";
import { ConfigurationController } from "./configuration-controller";

import { readJson, existsSync } from "fs-extra";

export class EnvironmentController {
  private static readonly NONE: QuickPickItem = {
    label: "<None>",
    description: "Select environment when executing command"
  };
  private _dbConfigPath: string;
  private static _statusBar: StatusBarItem;
  private _currentEnvironment: string | null = "DEV";

  public constructor() {
    this._dbConfigPath = ConfigurationController.getInstance().databaseConfigFile;
    EnvironmentController._statusBar = window.createStatusBarItem(
      StatusBarAlignment.Left,
      10
    );
    EnvironmentController._statusBar.tooltip = "Oradew: Set DB Environment";
    EnvironmentController._statusBar.command = `oradew.setDbEnvironment`;
    this.updateStatusBar();
  }

  private updateStatusBar = () => {
    EnvironmentController._statusBar.text = `$(gear) ${
      this._currentEnvironment
    }`;
    if (existsSync(this._dbConfigPath)) {
      EnvironmentController._statusBar.show();
    } else {
      EnvironmentController._statusBar.hide();
    }
  }

  // Create environment pick list from dbconfig file
  private createEnvironmentList = (): QuickPickItem[] => {
    return readJson(this._dbConfigPath).then(config => {
      return Object.keys(config).reduce((acc, value) => {
        return [
          ...acc,
          {
            label: value,
            description: config[value].connectString,
            picked: this._currentEnvironment === value
          }
        ];
      }, []);
    });
  }

  // Environment picker
  public pickEnvironment = async (
    addNoneOption?: boolean
  ): Promise<string | null> => {
    let envs: QuickPickItem[] = await this.createEnvironmentList();
    const options: QuickPickOptions = {
      placeHolder: "Select DB environment",
      matchOnDescription: true,
      matchOnDetail: true
    };
    if (addNoneOption === true) {
      envs.push(EnvironmentController.NONE);
    }
    return window
      .showQuickPick(envs, options)
      .then(item => (item ? item.label : null));
  }

  // Returns "defaultEnv" if it is set, otherwise let's you pick from the list
  public getEnvironment = async (): Promise<string | null> => {
    if (this._currentEnvironment === EnvironmentController.NONE.label) {
      return this.pickEnvironment(false);
    } else {
      return this._currentEnvironment;
    }
  }

  public setDbEnvironment = async (): Promise<void> => {
    const pickEnv = await this.pickEnvironment(true);
    if (pickEnv) {
      this._currentEnvironment = pickEnv;
      this.updateStatusBar();
    }
  }

  public clearDbEnvironment = async (): Promise<void> => {
    this._currentEnvironment = EnvironmentController.NONE.label;
    this.updateStatusBar();
  }

  public dispose() {
    EnvironmentController._statusBar.dispose();
  }
}
