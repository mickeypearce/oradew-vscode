import { existsSync, readJsonSync } from "fs-extra";
import { getDefaultsFromSchema } from "./common/config";
import { ConfigurationController } from "./configuration-controller";
import { QuickPickItem, QuickPickOptions, window } from "vscode";

interface IGenerator {
  label: string;
  function: string;
  description?: string;
  output?: string;
}

export class GeneratorManager {
  // Config file path
  file: string;
  defaults: any;
  // Json config object
  object: any;

  constructor() {
    this.file = null;
    this.defaults = getDefaultsFromSchema("../../resources/oradewrc-generate-schema.json");
  }

  getConfigFile = (): string => {
    return ConfigurationController.getInstance().generatorConfigFile;
  };

  read = (): void => {
    this.file = this.getConfigFile();
    this.object = existsSync(this.file) ? readJsonSync(this.file) : this.defaults;
  };

  getDefinitions = (): Array<IGenerator> => {
    this.read();
    return this.object["generator.define"];
  };

  private createGeneratorList = (): QuickPickItem[] => {
    return this.getDefinitions().map((generator) => {
      return {
        label: generator.label,
        description: generator.description,
        detail: generator.function,
      };
    });
  };

  public getGeneratorFunction = async (): Promise<string | null> => {
    let gens: QuickPickItem[] = await this.createGeneratorList();
    const options: QuickPickOptions = {
      placeHolder: "Select generator",
      matchOnDescription: true,
      matchOnDetail: true,
    };

    return window.showQuickPick(gens, options).then((item) => (item ? item.detail : null));
  };
}
