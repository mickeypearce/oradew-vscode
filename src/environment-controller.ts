import {
  QuickPickItem,
  window,
  StatusBarAlignment,
  StatusBarItem,
  QuickPickOptions
} from "vscode";
import { readJson, existsSync } from "fs-extra";

export class EnvironmentController {
  private static readonly NONE: QuickPickItem = {
    label: "<None>",
    description: "Select environment when executing command"
  };
  private _dbConfigPath: string;
  private _statusBar: StatusBarItem;
  private _currentEnvironment: string | null = "DEV";

  public constructor(dbConfigPath: string) {
    this._dbConfigPath = dbConfigPath;
    this._statusBar = window.createStatusBarItem(StatusBarAlignment.Left, 10);
    this._statusBar.tooltip = "Oradew: Set DB Environment";
    this._statusBar.command = `oradew.setDbEnvironment`;
    this.updateStatusBar();
  }

  public updateStatusBar = () => {
    this._statusBar.text = `$(gear) ${this._currentEnvironment}`;
    if (existsSync(this._dbConfigPath)) {
      this._statusBar.show();
    } else {
      this._statusBar.hide();
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
      placeHolder: "Pick DB environment",
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
    this._statusBar.dispose();
  }
}
