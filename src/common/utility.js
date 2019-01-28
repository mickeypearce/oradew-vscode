import { sep, parse, resolve, relative, join } from "path";
import { existsSync, readJsonSync, outputJsonSync, outputFile } from "fs-extra";
const exec = require("child_process").exec;

let utils = {};

let mapDirToObjectType = {
  PACKAGES: "PACKAGE",
  PROCEDURES: "PROCEDURE",
  FUNCTIONS: "FUNCTION",
  PACKAGE_BODIES: "PACKAGE BODY",
  VIEWS: "VIEW",
  TRIGGERS: "TRIGGER",
  TYPES: "TYPE",
  TYPE_BODIES: "TYPE BODY",
  TABLES: "TABLE"
};

let mapObjectTypeAlternative = {
  PACKAGE: "PACKAGE_SPEC",
  "PACKAGE BODY": "PACKAGE_BODY",
  TYPE: "TYPE_SPEC",
  "TYPE BODY": "TYPE_BODY"
};

// Simple invert object function
// Avoid importing _lodash
const invert = obj => val => {
  for (let key in obj) {
    if (obj[key] === val) return key;
  }
};

utils.getDirTypes = () => Object.keys(mapDirToObjectType);
utils.getObjectTypes = () => Object.values(mapDirToObjectType);
utils.getObjectTypeFromDir = dir => mapDirToObjectType[dir] || dir;
utils.getObjectType1FromObjectType = type =>
  mapObjectTypeAlternative[type] || type;
utils.getDirFromObjectType = type => invert(mapDirToObjectType)(type) || type;

utils.getDBObjectFromPath = path => {
  if (!path) return { owner: undefined };
  // Path can be relative or absolute
  // tasks ${file} is absolute for ex
  const absPath = resolve(path);
  const base = resolve("./");
  const relPath = relative(base, absPath);
  const pathSplit = relPath.split(sep);

  let owner, objectName, dir, objectType, objectType1;
  // Object name is always from file name
  objectName = parse(absPath).name;

  let isScript, isSource;
  // Glob matching is too costy...
  isScript = pathSplit[0].toLowerCase() === "scripts";
  isSource = pathSplit[0].toLowerCase() === "src";

  // console.log("path=" + path);
  // console.log("pathSplit=" + pathSplit);
  // console.log("isscript=" + isScript);
  // console.log("issource=" + isSource);

  // We determine owner from path in Source and Scripts folder
  // Null otherwise
  if (isScript) {
    // `./${scripts}/${owner}/${name}.sql`,
    // owner = pathSplit[1];
    owner = pathSplit[pathSplit.length - 2];
    // If owner is missing (scripts structure without owner)
    // Legacy - single schema workspace
    if (owner.toLowerCase() === "scripts") {
      owner = null;
    }
    dir = "SCRIPTS"; //non existent type but no problem
  } else if (isSource) {
    // `./${source}/${owner}/${dir}/${name}.sql`,
    // owner = pathSplit[1];
    // dir = pathSplit[2];
    // More resilient if we go backwards
    owner = pathSplit[pathSplit.length - 3];
    // If owner is missing (src structure without owner)
    // Legacy - single schema workspace
    if (owner.toLowerCase() === "src") {
      owner = null;
    }
    dir = pathSplit[pathSplit.length - 2];
  } else {
    // `./${deploy}/${name}.sql`,
    // No owner here
    // will go for default when looking for conn conf
    owner = null;
    // dir = pathSplit[0];
    dir = "FILE";
  }

  objectType = utils.getObjectTypeFromDir(dir);
  objectType1 = utils.getObjectType1FromObjectType(objectType);

  // console.log("owner=" + owner);
  // console.log("objectName=" + objectName);
  // console.log("objectType=" + objectType);

  return {
    owner,
    objectName,
    objectType,
    objectType1,
    isScript,
    isSource
  };
};

// Build default object from json schema defaults
// simplified - only defaults from first level in tree
export const getDefaultsFromSchema = schema => {
  const template = require(schema).properties;
  return Object.keys(template).reduce((acc, value) => {
    return { ...acc, [value]: template[value].default };
  }, {});
};

/**
 * Workspace configuration (one for each environment.)
 *
 * Config file extending sequence: defaults <== DEV (base) <== (TEST, UAT)
 *
 * DEV (base): ./oradewrc.json
 * TEST: ./oradewrc.test.json (optional)
 * UAT: ./oradewrc.uat.json (optional)
 */
export class WorkspaceConfig {
  constructor(fileBase) {
    // Defaults configuration object
    this.defaults = getDefaultsFromSchema(
      "../../resources/oradewrc-schema.json"
    );
    this.fileBase = fileBase || "./oradewrc.json";

    let parsed = parse(this.fileBase);
    this.fileTest = resolve(parsed.dir, `${parsed.name}.test${parsed.ext}`);
    this.fileUat = resolve(parsed.dir, `${parsed.name}.uat${parsed.ext}`);

    this.objectBase = null;
    this.objectTest = null;
    this.objectUat = null;
  }

  read() {
    return {
      objectBase: existsSync(this.fileBase)
        ? readJsonSync(this.fileBase, "utf8")
        : {},
      objectTest: existsSync(this.fileTest)
        ? readJsonSync(this.fileTest, "utf8")
        : {},
      objectUat: existsSync(this.fileUat)
        ? readJsonSync(this.fileUat, "utf8")
        : {}
    };
  }
  load() {
    const { objectBase, objectTest, objectUat } = this.read();
    this.objectBase = { ...this.defaults, ...objectBase };
    this.objectTest = { ...this.objectBase, ...objectTest };
    this.objectUat = { ...this.objectBase, ...objectUat };
  }
  // Input param can be object: { field, env }
  // or just string "field" (env is DEV by default)
  // If Field is empty whole config object is returned
  get(param) {
    let field, env;
    if (typeof param === "object") {
      ({ field, env } = param);
    } else {
      field = param;
      env = "DEV";
    }
    switch (env) {
      case "TEST":
        if (!this.objectTest) this.load();
        return field ? this.objectTest[field] : this.objectTest;
      case "UAT":
        if (!this.objectUat) this.load();
        return field ? this.objectUat[field] : this.objectUat;
      default:
        if (!this.objectBase) this.load();
        return field ? this.objectBase[field] : this.objectBase;
    }
  }
  set(field, value) {
    this.objectBase[field] = value;
    const { objectBase } = this.read();
    return outputJsonSync(this.fileBase, {
      ...objectBase,
      ...{ [field]: value }
    });
  }
}
export const workspaceConfig = new WorkspaceConfig(process.env.wsConfigPath);
// export const createConfig = file => new Config(file);

export const getDBObjectFromPath = utils.getDBObjectFromPath;
export const getObjectTypeFromDir = utils.getObjectTypeFromDir;
export const getDirFromObjectType = utils.getDirFromObjectType;
export const getObjectTypes = utils.getObjectTypes;
export const getDirTypes = utils.getDirTypes;

const promisify = func => (...args) =>
  new Promise((resolve, reject) =>
    func(...args, (err, result) => (err ? reject(err) : resolve(result)))
  );

export const execPromise = promisify(exec);
export const outputFilePromise = promisify(outputFile);

export const removeNewlines = str => str.replace(/\r\n|\r|\n/gi, " ");

// alternative /\r?\n/
export const splitLines = str => str.split(/\r\n|\r|\n/);

/**
 * Includes - case insensitive.
 * * arr includes str?
 * @param {array} arr
 * @param {string} str
 * @returns {boolean}
 */
export const IncludesCaseInsensitive = (arr, str) => {
  let upp = arr.map(v => v.toUpperCase());
  return upp.includes(str.toUpperCase());
};
