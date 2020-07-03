import {
  QuickPickItem,
  window,
  StatusBarAlignment,
  StatusBarItem,
  QuickPickOptions,
  ExtensionContext,
} from "vscode";
import { ConfigurationManager } from "../common/configuration-manager";
import { Telemetry } from "../common/telemetry";

import { readJson, existsSync } from "fs-extra";

export class EnvironmentController {
  private static readonly NONE: QuickPickItem = {
    label: "<None>",
    description: "Select environment when executing command",
  };
  private _context: ExtensionContext;
  private _dbConfigPath: string;
  private static _statusBar: StatusBarItem;

  // This is saved for use by commands
  public get currentEnvironment(): string {
    return this._context.workspaceState.get("currEnv", "DEV");
  }
  public set currentEnvironment(env: string) {
    this.currentPick = env;
    this._context.workspaceState.update("currEnv", env);
  }

  // This is temporary. used for 'getDBuser' command in process of single task execution
  // to pass parameter between env and user commands
  public currentPick: string;

  public constructor(context: ExtensionContext) {
    this._context = context;
    this._dbConfigPath = ConfigurationManager.getInstance().databaseConfigFile;
    EnvironmentController._statusBar = window.createStatusBarItem(StatusBarAlignment.Left, 10);
    EnvironmentController._statusBar.tooltip = "Oradew: Set DB Environment";
    EnvironmentController._statusBar.command = `oradew.setDbEnvironment`;
    this.updateStatusBar();
    this.currentPick = this.currentEnvironment;
  }

  private updateStatusBar = () => {
    EnvironmentController._statusBar.text = `$(gear) Env: ${this.currentEnvironment}`;
    if (existsSync(this._dbConfigPath)) {
      EnvironmentController._statusBar.show();
    } else {
      EnvironmentController._statusBar.hide();
    }
  };

  // Create environment pick list from dbconfig file
  private createEnvironmentList = (): QuickPickItem[] => {
    return readJson(this._dbConfigPath).then((config) => {
      return Object.keys(config).reduce((acc, value) => {
        return [
          ...acc,
          {
            label: value,
            description: config[value].connectString,
            picked: this.currentEnvironment === value,
          },
        ];
      }, []);
    }) as any;
  };

  // Environment picker
  public pickEnvironment = async (addNoneOption?: boolean): Promise<string | null> => {
    let envs: QuickPickItem[] = await this.createEnvironmentList();
    const options: QuickPickOptions = {
      placeHolder: "Select DB environment for executing command",
      matchOnDescription: true,
      matchOnDetail: true,
    };
    if (addNoneOption === true) {
      envs.push(EnvironmentController.NONE);
    }
    return window.showQuickPick(envs, options).then((item) => {
      if (item) {
        this.currentPick = item.label;
        return this.currentPick;
      } else {
        return null;
      }
    });
  };

  // Returns "currentEnvironment" if it is set, otherwise let's you pick from the list
  public getEnvironment = async (): Promise<string | null> => {
    if (this.currentEnvironment === EnvironmentController.NONE.label) {
      return this.pickEnvironment(false);
    } else {
      return this.currentEnvironment;
    }
  };

  public setDbEnvironment = async (): Promise<void> => {
    const pickEnv = await this.pickEnvironment(true);
    if (pickEnv) {
      this.currentEnvironment = pickEnv;
      this.updateStatusBar();
    }
    Telemetry.sendEvent("setDbEnvironment", { env: pickEnv });
  };

  public clearDbEnvironment = async (): Promise<void> => {
    this.currentEnvironment = EnvironmentController.NONE.label;
    this.updateStatusBar();
    Telemetry.sendEvent("clearDbEnvironment");
  };

  public dispose() {
    EnvironmentController._statusBar.dispose();
  }
}
