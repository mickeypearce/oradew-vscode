import {
  QuickPickItem,
  window,
  StatusBarAlignment,
  StatusBarItem,
  QuickPickOptions,
  ExtensionContext,
} from "vscode";
import { ConfigurationController } from "./configuration-controller";
import { Telemetry } from "./telemetry";

import { EnvironmentController } from "./environment-controller";

import { readJson, existsSync } from "fs-extra";

export class UserController {
  private static readonly NONE: QuickPickItem = {
    label: "<None>",
    description: "Select user when executing command",
  };
  private static readonly AUTO: QuickPickItem = {
    label: "<Auto>",
    description: "User will be extracted from file path",
  };
  private _context: ExtensionContext;
  private _dbConfigPath: string;
  private _environmentController: EnvironmentController;
  private static _statusBar: StatusBarItem;
  private get currentUser(): string {
    return this._context.workspaceState.get("currUser", UserController.AUTO.label);
  }
  private set currentUser(user: string) {
    this._context.workspaceState.update("currUser", user);
  }

  public constructor(context: ExtensionContext, environmentController: EnvironmentController) {
    this._context = context;
    this._dbConfigPath = ConfigurationController.getInstance().databaseConfigFile;
    this._environmentController = environmentController;
    UserController._statusBar = window.createStatusBarItem(StatusBarAlignment.Left, 9);
    UserController._statusBar.tooltip = "Oradew: Set DB User";
    UserController._statusBar.command = `oradew.setDbUser`;
    this.updateStatusBar();
  }

  private updateStatusBar = () => {
    UserController._statusBar.text = `User: ${this.currentUser}`;
    if (existsSync(this._dbConfigPath)) {
      UserController._statusBar.show();
    } else {
      UserController._statusBar.hide();
    }
  };

  // Create user pick list from dbconfig file
  private createUserList = (env): QuickPickItem[] => {
    return <any>readJson(this._dbConfigPath).then((config) => {
      const users = config[env]?.users.filter((val) => !val.disabled) || [];
      return users.map((value) => ({
        label: value.user.toUpperCase(),
        description: `${value.user}@${config[env].connectString}`,
        picked: this.currentUser === value.user,
      }));
    });
  };

  // User picker
  // addNoneOption = true is called from set command (status bar)
  public pickUser = async (addNoneOption?: boolean): Promise<string | null> => {
    let currEnv;
    if (addNoneOption === true) {
      currEnv = this._environmentController.currentEnvironment;
    } else {
      currEnv = this._environmentController.currentPick;
    }
    let envs: QuickPickItem[] = await this.createUserList(currEnv);
    const options: QuickPickOptions = {
      placeHolder: "Select DB user for executing command",
      matchOnDescription: true,
      matchOnDetail: true,
    };
    envs.push(UserController.AUTO);
    if (addNoneOption === true) {
      envs.push(UserController.NONE);
    }
    return window.showQuickPick(envs, options).then((item) => (item ? item.label : null));
  };

  // Returns "currentUser" if it is set, otherwise let's you pick from the list
  public getUser = async (): Promise<string | null> => {
    if (this.currentUser === UserController.NONE.label) {
      return this.pickUser(false);
    } else {
      return this.currentUser;
    }
  };

  public setDbUser = async (): Promise<void> => {
    const pickedUser = await this.pickUser(true);
    if (pickedUser) {
      this.currentUser = pickedUser;
      this.updateStatusBar();
    }
    Telemetry.sendEvent("setDbUser", { user: pickedUser });
  };

  public clearDbUser = async (): Promise<void> => {
    this.currentUser = UserController.NONE.label;
    this.updateStatusBar();
    Telemetry.sendEvent("clearDbUser");
  };

  public dispose() {
    UserController._statusBar.dispose();
  }
}
