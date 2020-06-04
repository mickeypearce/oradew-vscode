import { includesCaseInsensitive } from "./utility";
import { existsSync, readJsonSync, outputJsonSync } from "fs-extra";
import { get, set, map, pipe, filter, flatMap, uniq, toUpper } from "lodash/fp";
import { parse, resolve } from "path";

// Build default object from json schema defaults
// simplified - only defaults from first level in tree
export function getDefaultsFromSchema(schema) {
  const template = require(schema).properties;
  return Object.keys(template).reduce((acc, value) => {
    return { ...acc, [value]: template[value].default };
  }, {});
}

interface IUser {
  user: string;
  password: string;
  default?: boolean;
  disabled?: boolean;
  schemas?: string[];
}

export interface IConnectionConfig extends IUser {
  env: string;
  connectString: string;
}

export class DBConfig {
  defaults: Object;
  fileBase: String;
  object: Object;
  constructor(fileBase) {
    // Defaults DB configuration object
    this.defaults = getDefaultsFromSchema("../../resources/dbconfig-schema.json");
    this.fileBase = fileBase || "./dbconfig.json";
    // DB config JSON Object
    this.object = null;
    this.load();
  }

  // Create config file with default values
  createFile() {
    return outputJsonSync(this.fileBase, this.defaults);
  }

  load() {
    try {
      this.object = readJsonSync(this.fileBase);
    } catch (e) {
      // Defaults
      console.log(`Cannot find ${this.fileBase} file...`);
      this.object = this.defaults;
    }
  }

  get(field) {
    return get(field)(this.object);
  }
  set(field, value) {
    this.object = set(field)(value)(this.object);
    return outputJsonSync(this.fileBase, this.object);
  }

  // _getConnectString = (env = "DEV") => this.object[env].connectString;
  // _getUserObjects = (env = "DEV") => this.object[env].users;

  // Get "users" object array from json
  // filter out disabled
  _getAllUsersByEnv = (env) => (data): IUser[] => {
    return pipe(
      get(env),
      get("users"),
      filter((v: IUser) => !v.disabled)
    )(data);
  };

  /**
   * Get all schemas for environment.
   * *If User has no objects, Schemas are used
   *
   *  @param {string} env
   *  @returns {string[]} user
   */
  getSchemas = (env = "DEV") => {
    return pipe(
      this._getAllUsersByEnv(env),
      flatMap((v) => (v.schemas ? v.schemas : [v.user])),
      map(toUpper),
      uniq
    )(this.object);
  };

  /**
   ** Get connection configuration. Extracted from DB config file.
   * Filter by env and user
   * User parameter is optional, return default configuration if cannot be determined (user non existent)
   * @param {string} env
   * @param {string} [user]
   * @returns {IConnectionConfig} Connection config
   */
  getConfiguration = (env, user?): IConnectionConfig => {
    if (!env) {
      throw Error(`No env parameter.`);
    }
    if (!this.object[env]) {
      throw Error(`Cannot find ${env} environment in dbconfig.json.`);
    }

    // Head of flattened object that we return
    const head = { env, connectString: this.object[env].connectString };

    // First filter by env param, if only one config return
    let byEnv = this._getAllUsersByEnv(env)(this.object);

    if (!byEnv) {
      throw Error(`dbconfig.json: Invalid structure. Cannot find "${env}" env.`);
    }

    if (byEnv.length === 0) {
      throw Error(`dbconfig.json: No user for "${env}" env.`);
    }
    if (byEnv.length === 1) {
      return { ...head, ...byEnv[0] };
    }

    // If user param exists, filter by v.user or v.schema
    let byUser = user
      ? filter(
          (v: IUser) =>
            v.user.toUpperCase() === user.toUpperCase() ||
            // includesCaseInsensitive([v.user], user) ||
            (v.schemas && includesCaseInsensitive(v.schemas, user))
        )(byEnv)
      : byEnv;

    if (byUser.length === 1) {
      return { ...head, ...byUser[0] };
    }
    // non existing user -> go for default
    // if (byUser.length === 0) {
    //   byUser = byEnv;
    // }

    // We couldn't match by user so go for default for env
    let byDefault = filter({ default: true } as IUser)(byEnv);

    if (byDefault.length === 1) {
      return { ...head, ...byDefault[0] };
    } else {
      throw Error(
        `dbconfig.json: No match for user "${user}" in "${env}". Add/Enable missing user or set default user for env ("default": true).`
      );
    }
  };
}
export const dbConfig = new DBConfig(process.env.ORADEW_DB_CONFIG_PATH);

/**
 * Workspace configuration
 *
 * * Base config applies to all environemnts.
 * But can be exteneded with env specific configs
 *
 * Config file extending sequence: defaults <== (BASE) <== (DEV, TEST, UAT, ...)
 *
 * (base): ./oradewrc.json
 *
 * Env specific configs:
 * DEV: ./oradewrc.dev.json (optional)
 * TEST: ./oradewrc.test.json (optional)
 * UAT: ./oradewrc.uat.json (optional)
 * ...
 * customEnv: ./oradewrc.customEnv.json (optional)
 */
export class WorkspaceConfig {
  defaults: Object;
  filePathBase: string;
  object: Object;
  constructor(fileBase?: string) {
    // Defaults configuration object
    this.defaults = getDefaultsFromSchema("../../resources/oradewrc-schema.json");
    this.filePathBase = fileBase || "./oradewrc.json";

    this.object = {};

    // Base default config file
    this.object["BASE"] = null;
    this.getConfigObject("BASE");

    // env objects are created on demand: this.object["DEV"], ....
  }

  getFileEnv(env = "BASE") {
    if (env === "BASE") {
      return this.filePathBase;
    }
    let parsed = parse(this.filePathBase);
    return resolve(parsed.dir, `${parsed.name}.${env}${parsed.ext}`);
  }

  readFile(env) {
    let filename = this.getFileEnv(env);
    let res = existsSync(filename) ? readJsonSync(filename, "utf8") : {};
    return res;
  }

  getConfigObject(env) {
    // Base configs extends from defaults..
    if (!this.object["BASE"]) {
      const objectBase = this.readFile("BASE");
      this.object["BASE"] = { ...this.defaults, ...objectBase };
    }

    // Create object for env - extended with base configs
    if (!this.object[env]) {
      const object = this.readFile(env);
      this.object[env] = { ...this.object["BASE"], ...object };
    }
  }

  // Input param can be object: { field, env }
  // or just string "field" (env is BASE by default)
  // If Field is empty whole config object is returned
  get(param) {
    let field, env;
    if (typeof param === "object") {
      ({ field, env } = param);
    } else {
      field = param;
      env = "BASE";
    }

    this.getConfigObject(env);
    return field ? this.object[env][field] : this.object[env];
  }

  set(field, value, env = "BASE") {
    // Update local object
    if (this.object[env]) {
      this.object[env][field] = value;
    }

    // If BASE changes discard all other env because are inherited
    if (env === "BASE") {
      let _base = this.object["BASE"];
      this.object = {};
      this.object["BASE"] = _base;
    }

    // Add property to env file
    const filename = this.getFileEnv(env);
    const object = this.readFile(env);
    return outputJsonSync(filename, {
      ...object,
      ...{ [field]: value },
    });
  }
}
export const workspaceConfig = new WorkspaceConfig(process.env.ORADEW_WS_CONFIG_PATH);
// export const createConfig = file => new Config(file);
