import { sep, parse, resolve, relative, join } from "path";
import { existsSync, readJsonSync, outputJsonSync, outputFile } from "fs-extra";
const exec = require("child_process").exec;

// import { getObjectInfo } from "./dbobject";

let utils = {};

// Build default object from json schema defaults
// simplified - only defaults from first level in tree
export const getDefaultsFromSchema = schema => {
  const template = require(schema).properties;
  return Object.keys(template).reduce((acc, value) => {
    return { ...acc, [value]: template[value].default };
  }, {});
};

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
  constructor(fileBase) {
    // Defaults configuration object
    this.defaults = getDefaultsFromSchema(
      "../../resources/oradewrc-schema.json"
    );
    this.filePathBase = fileBase || "./oradewrc.json";

    this.object = {};

    // Base default config file
    this.object["BASE"] = null;
    this.getConfigObject("BASE");

    // env objects are created on demand: this.object["DEV"], ....
  }

  getFileEnv(env = "BASE") {
    if (env === "BASE") return this.filePathBase;
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
    if (this.object[env]) this.object[env][field] = value;

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
      ...{ [field]: value }
    });
  }
}
export const workspaceConfig = new WorkspaceConfig(
  process.env.ORADEW_WS_CONFIG_PATH
);
// export const createConfig = file => new Config(file);

const promisify = func => (...args) =>
  new Promise((resolve, reject) =>
    func(...args, (err, result) => (err ? reject(err) : resolve(result)))
  );

export const execPromise = promisify(exec);
export const outputFilePromise = promisify(outputFile);

export const removeNewlines = str => str.replace(/\r\n|\r|\n/gi, " ");

// alternative /\r?\n/
export const splitLines = str => str.split(/\r\n|\r|\n/);

// Conditionally prepends char if it doesn't starts already
// prependCheck("a")("aabc") => 'aabc'
// prependCheck("a")("bbc") => 'abbc'
export const prependCheck = val => str =>
  str.startsWith(val) ? str : `${val}${str}`;

// Add ./ if it doesn't already exists
export const rootPrepend = prependCheck("./");
// Remove ./ from path
export const rootRemove = str => str.replace(/\.\//, "");

/**
 * Includes - case insensitive.
 * * arr includes str?
 * @param {array} arr
 * @param {string} str
 * @returns {boolean}
 */
export const includesCaseInsensitive = (arr, str) => {
  let upp = arr.map(v => v.toUpperCase());
  return upp.includes(str.toUpperCase());
};

/**
 * Includes paths - absolute or relative.
 * * arrPaths includes path?
 * @param {array} arrPaths
 * @param {string} path
 * @returns {boolean}
 */
export const includesPaths = (arrPaths, path) => {
  let absPaths = arrPaths.map(p => resolve(p));
  let absPath = resolve(path);
  return absPaths.includes(absPath);
};
