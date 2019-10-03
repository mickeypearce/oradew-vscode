const micromatch = require("micromatch");
// import { utils } from "../common/utility";
const assert = require("assert");
import { WorkspaceConfig, rootRemove } from "../common/utility";
import { sep, parse, resolve, relative, join } from "path";
import {
  zipObject,
  difference,
  trimCharsEnd,
  trimCharsStart,
  pipe
} from "lodash/fp";
import { lstatSync } from "fs";

const config = new WorkspaceConfig(
  __dirname + "/resources/oradewrc.default.json"
);

function getObjectTypeFromPath(path) {
  let patternsArray = config.get("source.pattern");
  // console.log("path=" + path);
  return Object.keys(patternsArray).filter(element => {
    let pattern = patternsArray[element];
    // console.log("pattern=" + pattern);
    let globPattern = pattern.replace(/{schema-name}|{object-name}/gi, "*");
    // console.log("globPattern=" + globPattern);
    return micromatch.isMatch(path, globPattern, {
      format: rootRemove
    });
  })[0];
}

function getObjectInfo(path) {
  let patternsArray = config.get("source.pattern");
  let objectType = getObjectTypeFromPath(path);

  // pattern="./src/{schema-name}/PACKAGES/{object-name}-spec.sql"
  let pattern = patternsArray[objectType];

  // Get left and right of schema path
  // p1 = ["./src/", "/PACKAGES/{object-name}-spec.sql"]
  let schemaSplit = pattern.split("{schema-name}");

  // Convert to regex so we can find and replace
  // p1 = ["/.\/src\//", "/\/PACKAGES\/\w+-spec.sql/"]
  let schemaRegex = schemaSplit.map(
    v => new RegExp(v.replace("{object-name}", "\\w+"))
  );

  // Remove both from path
  // o = ["./src/", "/PACKAGES/*-spec.sql"]
  let schema = schemaRegex.reduce((acc, val) => acc.replace(val, ""), path);

  // Similar for object-name
  let objectSplit = pattern.split("{object-name}");
  let objectRegex = objectSplit.map(
    v => new RegExp(v.replace("{schema-name}", "\\w+"))
  );
  let objectName = objectRegex.reduce((acc, val) => acc.replace(val, ""), path);

  return {
    schema,
    objectType,
    objectName
  };
}
console.log(
  "getObjectTypeFromPath=" +
    JSON.stringify(
      getObjectTypeFromPath("./src/NKAP/PACKAGES/PCK_DOKUMENTI.sql")
    )
);
console.log(
  "getObjectInfo=" +
    JSON.stringify(getObjectInfo("./src/NKAP/PACKAGES/PCK_DOKUMENTI.sql"))
);

let a = micromatch.isMatch(
  "./src/NKAP/PACKAGE_BODIES/PCK_DOKUMENTI-spec.sql",
  "./src/*/PACKAGE_BODIES/*-spec.sql",
  {
    format: str => str.replace(/\.\//, "")
  }
);
console.log("a=" + a);

let b = micromatch.isMatch(
  "./src/NKAP/PACKAGE_BODIES/PCK_DOKUMENTI.sql",
  "./src/*/TRIGGERS/*.sql",
  {
    format: str => str.replace(/\.\//, "")
  }
);
console.log("b=" + b);

console.log(
  difference(["PCK_DOKUMENTI", "-spec.sql"], ["{object-name}", "-spec.sql"])
);
