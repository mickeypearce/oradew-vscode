const micromatch = require("micromatch");

import { rootRemove, rootPrepend, workspaceConfig } from "./utility";
import { parse, resolve, relative, posix, dirname } from "path";
import { invert } from "lodash/fp";

// const config = new WorkspaceConfig(
//   __dirname + "/resources/oradewrc.default.json"
// );

const config = workspaceConfig; //new WorkspaceConfig();
const patternsArray = config.get("source.pattern");

function getObjectTypeFromPath(path) {
  // Filter patterns that match a path
  const foundPattern = Object.keys(patternsArray).filter(element => {
    const pattern = patternsArray[element];
    // We use globs for matching, so replace variables with wildcard (*)
    const globPattern = pattern.replace(/{schema-name}|{object-name}/gi, "*");
    // Globpattern have to be without ./, but We have it in config for unknown reason...
    return micromatch.isMatch(path, globPattern, {
      format: rootRemove
    });
  });
  return foundPattern[0];
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
  table: "TABLE"
};

const mapToOraObjectTypeAlt = {
  packageSpec: "PACKAGE_SPEC",
  packageBody: "PACKAGE_BODY",
  typeSpec: "TYPE_SPEC",
  typeBody: "TYPE_BODY"
};

const mapfromOraObjectType = invert(mapToOraObjectType);

export function getObjectInfoFromPath(path) {
  let schema, objectName, objectType;

  // Convert path to relative
  const absPath = resolve(path);
  const base = resolve("./");
  const relPath = relative(base, absPath);

  // Convert path to posix with ./
  const pathPosix = rootPrepend(relPath.replace(/\\/gi, "/"));

  objectType = getObjectTypeFromPath(pathPosix);

  // pattern="./src/{schema-name}/PACKAGES/{object-name}-spec.sql"
  const pattern = patternsArray[objectType];

  // If pattern is not configured for object type, we set objecttype=script
  // and objectname=filename, schema is second dir in path
  // we assume it as a script
  if (!pattern) {
    // const absPath = resolve(path);
    // const base = resolve("./");
    // const relPath = relative(base, absPath);
    const pathSplit = pathPosix.split("/");

    // If path don't include schema (too short :), we set it to "" which means default schema will be used
    // ./scripts/HR/initial_dml.sql (4) or ./deploy/Release.sql (3)
    schema = pathSplit.length > 3 ? pathSplit[2] : "";
    objectName = parse(absPath).name;
    return {
      owner: schema,
      objectType: "script",
      objectType1: "script",
      objectName,
      isSource: false,
      isScript: true
    };
  }

  /** extact schema*/
  // Get left and right of schema path
  // p1 = ["./src/", "/PACKAGES/{object-name}-spec.sql"]
  const schemaSplit = pattern.split("{schema-name}");

  // Convert to regex so we can find and replace
  // p1 = ["/.\/src\//", "/\/PACKAGES\/\w+-spec.sql/"]
  const schemaRegex = schemaSplit.map(
    v => new RegExp(v.replace("{object-name}", "\\w+"))
  );

  // Remove both from path
  // o = ["./src/", "/PACKAGES/*-spec.sql"]
  schema = schemaRegex.reduce((acc, val) => acc.replace(val, ""), pathPosix);

  /** extact object-name*/
  const objectSplit = pattern.split("{object-name}");
  const objectRegex = objectSplit.map(
    v => new RegExp(v.replace("{schema-name}", "\\w+"))
  );
  objectName = objectRegex.reduce(
    (acc, val) => acc.replace(val, ""),
    pathPosix
  );

  // Map to ora types
  const objectTypeOra = mapToOraObjectType[objectType] || objectType;
  const objectTypeOraAlt = mapToOraObjectTypeAlt[objectType] || objectTypeOra;

  // Info if it is Source, @todo better way
  // const isSource = objectType !== "script";
  // const isScript = objectType === "script";
  return {
    owner: schema,
    objectName,
    objectType: objectTypeOra,
    objectType1: objectTypeOraAlt,
    isSource: true,
    isScript: false
  };
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
  const pattern = patternsArray[type];
  // Replace variables in pattern with values
  const path = replaceVarsInPattern(pattern, owner, name);
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
  return Object.keys(patternsArray).map(el => dirname(patternsArray[el]));
}

export function getObjectTypes() {
  return Object.values(mapToOraObjectType);
}
