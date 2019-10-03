const micromatch = require("micromatch");

import { rootRemove, rootPrepend, workspaceConfig } from "./utility";
import { parse, resolve, relative, posix } from "path";

// const config = new WorkspaceConfig(
//   __dirname + "/resources/oradewrc.default.json"
// );

const config = workspaceConfig; //new WorkspaceConfig();
const patternsArray = config.get("source.pattern");

function getObjectTypeFromPath(path) {
  // Filter patterns that match a path
  const pattern = Object.keys(patternsArray).filter(element => {
    const pattern = patternsArray[element];
    // We use globs for matching, so replace variables with wildcard (*)
    const globPattern = pattern.replace(/{schema-name}|{object-name}/gi, "*");
    // Globpattern have to be without ./, but We have it in config for unknown reason...
    return micromatch.isMatch(path, globPattern, {
      format: rootRemove
    });
  });
  return pattern[0];
}

let mapToOraObjectType = {
  "package-spec": "PACKAGE",
  procedure: "PROCEDURE",
  function: "FUNCTION",
  "package-body": "PACKAGE BODY",
  view: "VIEW",
  trigger: "TRIGGER",
  "type-spec": "TYPE",
  "type-body": "TYPE BODY",
  table: "TABLE"
};

let mapToOraObjectTypeAlt = {
  "package-spec": "PACKAGE_SPEC",
  "package-body": "PACKAGE_BODY",
  "type-spec": "TYPE_SPEC",
  "type-body": "TYPE_BODY"
};

export function getObjectInfo(path) {
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
