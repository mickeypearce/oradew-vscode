import { QuickPickItem, QuickPickOptions, window } from "vscode";
import { existsSync, readJsonSync } from "fs-extra";
import { ConfigurationManager } from "../common/configuration-manager";
import { getDefaultsFromSchema } from "@Cli/common/config";
import { properties as genSchema } from "@Cli/schemas/oradewrc-generate-schema.json";

interface IGenerator {
  label: string;
  function: string;
  description?: string;
  output?: string;
}

export class GeneratorController {
  // Config file path
  file: string;
  defaults: any;
  // Json config object
  object: any;

  constructor() {
    this.file = null;
    this.defaults = getDefaultsFromSchema(genSchema);
  }

  getConfigFile = (): string => {
    return ConfigurationManager.getInstance().generatorConfigFile;
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
