const micromatch = require("micromatch");

import { rootRemove, rootPrepend, workspaceConfig } from "./utility";
import { parse, resolve, relative, posix, dirname } from "path";
import { invert } from "lodash/fp";
import { fromGlobsToFilesArray } from "./globs";

// const config = new WorkspaceConfig(
//   __dirname + "/resources/oradewrc.default.json"
// );

const config = workspaceConfig; //new WorkspaceConfig();

const patternSrcObject = config.get("source.pattern");
// {
//   "packageSpec": "./src/{schema-name}/pck/{object-name}-spec.sql",
//   "packageBody": "./src/{schema-name}/pck/{object-name}-body.sql",
//   "trigger": "./src/{schema-name}/trigger-{object-name}.sql",
//   "view": "./src/{schema-name}/view-{object-name}.sql",
//   "function": "./test/src/{schema-name}/FUNCTIONS/{object-name}.sql",
//   "procedure": "./src/PROCEDURES/{object-name}.sql",
// }

function getObjectTypeFromSrcPath(path) {
  // Filter patterns that match a path
  const foundPattern = Object.keys(patternSrcObject).filter((element) => {
    const pattern = patternSrcObject[element];
    // We use globs for matching, so replace variables with wildcard (*)
    const globPattern = pattern.replace(/{schema-name}|{object-name}/gi, "*");
    // Globpattern have to be without ./, but We have it in config for unknown reason...
    return micromatch.isMatch(path, globPattern, {
      format: rootRemove,
    });
  });
  return foundPattern[0];
}

const patternPckOutput = config.get("package.output");
//   "./deploy/{schema-name}/Run.sql"
function isDeployPath(path) {
  const globPattern = patternPckOutput.replace(/{schema-name}|{object-name}/gi, "*");
  return micromatch.isMatch(path, globPattern, {
    format: rootRemove,
  });
}

// Match ./deploy/{schema-name}/Run.sql to actual files
export function matchOutputFiles(outputFilePattern, options) {
  const globPattern = outputFilePattern.replace(
    /{schema-name}|{object-name}/gi,
    "*"
  );
  const files = fromGlobsToFilesArray(globPattern, options);
  return files;
}

const mapToOraObjectType = {
  packageSpec: "PACKAGE",
  procedure: "PROCEDURE",
  function: "FUNCTION",
  packageBody: "PACKAGE BODY",
  view: "VIEW",
  trigger: "TRIGGER",
  typeSpec: "TYPE",
  typeBody: "TYPE BODY",
  table: "TABLE",
  synonym: "SYNONYM",
};

const mapToOraObjectTypeAlt = {
  packageSpec: "PACKAGE_SPEC",
  packageBody: "PACKAGE_BODY",
  typeSpec: "TYPE_SPEC",
  typeBody: "TYPE_BODY",
};

const mapfromOraObjectType = invert(mapToOraObjectType);

/**
 * Object def
 * @typedef {{owner: string, objectType?: string, objectType1?: string, objectName?: string, isSource?: string, isScript?: string}} ObjectDefinition
 */

/**
 ** Extract object info from file path
 * SRC: patterns array defined in "source.pattern"
 * deployScript: pattern "package.output"
 * script otherwire
 * @param {string} path
 * @returns {ObjectDefinition} object
 */
export function getObjectInfoFromPath(path) {
  if (!path) return { owner: undefined };

  let schema, objectName, objectType;

  // Convert path to relative
  const absPath = resolve(path);
  const base = resolve("./");
  const relPath = relative(base, absPath);

  // Convert path to posix with ./
  const pathPosix = rootPrepend(relPath.replace(/\\/gi, "/"));

  // Is it a SRC file?
  objectType = getObjectTypeFromSrcPath(pathPosix);

  if (objectType) {
    // pattern="./src/{schema-name}/PACKAGES/{object-name}-spec.sql"
    const patternSrc = patternSrcObject[objectType];

    /** extact schema*/
    // Get left and right of schema path
    // p1 = ["./src/", "/PACKAGES/{object-name}-spec.sql"]
    const schemaSplit = patternSrc.split("{schema-name}");

    // Convert to regex so we can find and replace
    // p1 = ["/.\/src\//", "/\/PACKAGES\/\w+-spec.sql/"]
    const schemaRegex = schemaSplit.map(
      (v) => new RegExp(v.replace("{object-name}", "\\w+"))
    );

    // Remove both from path
    // ex: path: "./src/HR/PACKAGES/pck1-spec.sql"
    // replace ["./src/", "/PACKAGES/\w+-spec.sql"] with "", leaving "HR"
    // actually: pathPosix.replace(schemaRegex[0]).replace(schemaRegex[1])
    schema = schemaRegex.reduce((acc, val) => acc.replace(val, ""), pathPosix);

    /** extact object-name*/
    const objectSplit = patternSrc.split("{object-name}");
    const objectRegex = objectSplit.map(
      (v) => new RegExp(v.replace("{schema-name}", "\\w+"))
    );
    objectName = objectRegex.reduce(
      (acc, val) => acc.replace(val, ""),
      pathPosix
    );

    // Map to ora types
    const objectTypeOra = mapToOraObjectType[objectType] || objectType;
    const objectTypeOraAlt = mapToOraObjectTypeAlt[objectType] || objectTypeOra;

    return {
      owner: schema,
      objectName,
      objectType: objectTypeOra,
      objectType1: objectTypeOraAlt,
      isSource: true,
      isScript: false,
    };
  }

  // Is it a deploy script?
  const isDeploy = isDeployPath(pathPosix);
  if (isDeploy) {
    // pattern="./deploy/{schema-name}/Run.sql"
    const patternPck = patternPckOutput;// patternDeployObject[objectType];

    /** extact schema*/
    // Get left and right of schema path
    // p1 = ["./deploy/", "/Run.sql"]
    const schemaSplit = patternPck.split("{schema-name}");
    schema = pathPosix.replace(schemaSplit[0], "").replace(schemaSplit[1], "");
    objectName = parse(absPath).name;
    return {
      owner: schema,
      objectType: "deployScript",
      objectType1: "deployScript",
      objectName,
      isSource: false,
      isScript: true,
    };
  }

  // If pattern is not configured for object type, we set objecttype=script
  // and objectname=filename, schema is second dir in path
  // we assume it as a script
  if (!objectType) {
    const pathSplit = pathPosix.split("/");

    // If path don't include schema (too short :), we set it to undefined which means default schema will be used
    // ./scripts/HR/initial_dml.sql (4) or ./deploy/Release.sql (3)
    schema = pathSplit.length > 3 ? pathSplit[2] : undefined;
    objectName = parse(absPath).name;
    return {
      owner: schema,
      objectType: "script",
      objectType1: "script",
      objectName,
      isSource: false,
      isScript: true,
    };
  }
}

export function replaceVarsInPattern(pattern = "", owner, name) {
  return pattern.replace("{schema-name}", owner).replace("{object-name}", name);
}

/**
 *
 * @param {string} owner
 * @param {string} oraType
 * @param {string} name
 * @returns {string} Relative path
 */
export function getPathFromObjectInfo(owner, oraType, name) {
  // Get pattern for object type
  const type = mapfromOraObjectType[oraType] || oraType;
  const pattern = patternSrcObject[type];
  // Replace variables in pattern with values
  const path = replaceVarsInPattern(pattern, owner, name);
  return path;
}

export function getPackageOutputPath({ owner }) {
  // Replace variables in pattern with values
  const path = replaceVarsInPattern(patternPckOutput, owner);
  return path;
}

/**
 * Return patters array without file (dir structure)
 *
 * @returns {Array} dir structure
 * example:
 * from
 * {"packageSpec": "./src/{schema-name}/PACKAGES/{object-name}.sql",
 * "packageBody": "./src/{schema-name}/PACKAGE_BODIES/{object-name}.sql"}
 * to
 * ["./src/{schema-name}/PACKAGES",
 * "./src/{schema-name}/PACKAGE_BODIES"]
 */

export function getStructure() {
  return Object.keys(patternSrcObject).map((el) =>
    dirname(patternSrcObject[el])
  );
}

export function getObjectTypes() {
  return Object.values(mapToOraObjectType);
}
