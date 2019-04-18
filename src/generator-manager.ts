import { existsSync, readJsonSync } from "fs-extra";
import { getDefaultsFromSchema } from "./common/utility";
import { ConfigurationController } from "./configuration-controller";

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
    this.defaults = getDefaultsFromSchema(
      "../../resources/oradewrc-generate-schema.json"
    );
  }

  getConfigFile = (): string => {
    return ConfigurationController.getInstance().generatorConfigFile;
  }

  read = (): void => {
    this.file = this.getConfigFile();
    this.object = existsSync(this.file)
      ? readJsonSync(this.file)
      : this.defaults;
  }

  getDefinitions = (): Array<IGenerator> => {
    this.read();
    return this.object["generator.define"];
  }
}
