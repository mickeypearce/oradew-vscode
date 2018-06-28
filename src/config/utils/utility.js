import { sep, parse, resolve } from "path";
import { TextEditorCursorStyle } from "vscode";

let utils = {};

// const owner = "NKAP"; //require("./db").getUser("DEV");

let mapDirToObjectType = {
  PACKAGES: "PACKAGE",
  PROCEDURES: "PROCEDURE",
  FUNCTIONS: "FUNCTION",
  PACKAGE_BODIES: "PACKAGE BODY",
  VIEWS: "VIEW",
  TRIGGERS: "TRIGGER",
  TYPES: "TYPE",
  TYPE_BODIES: "TYPE BODY"
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
  path = resolve(path);
  const pathSplit = path.split(sep);

  let owner, objectName, dir, objectType, objectType1;
  // Object name is always from file name
  objectName = parse(path).name;

  let isScript, isSource;
  // Problem if db user=scripts, but glob matching is too costy...
  isScript = pathSplit[pathSplit.length - 3].toLowerCase() === "scripts";
  isSource = pathSplit[pathSplit.length - 4].toLowerCase() === "src";

  // console.log("path=" + path);
  // console.log("pathSplit=" + pathSplit);
  // console.log("isscript=" + isScript);
  // console.log("issource=" + isSource);

  // We determine owner from path in Source and Scripts folder
  // Null otherwise
  if (isScript) {
    // `./${scripts}/${owner}/${name}.sql`,
    // Owner is important
    // unfortunately is on different position than in Source
    owner = pathSplit[pathSplit.length - 2];
    dir = "SCRIPTS"; //non existent but no problem
  } else if (isSource) {
    // `./${source}/${owner}/${dir}/${name}.sql`,
    owner = pathSplit[pathSplit.length - 3];
    dir = pathSplit[pathSplit.length - 2];
  } else {
    // `./${deploy}/${name}.sql`,
    // No owner here
    // will go for default when looking for conn conf
    owner = null;
    dir = pathSplit[pathSplit.length - 2];
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

export const getDBObjectFromPath = utils.getDBObjectFromPath;
export const getObjectTypeFromDir = utils.getObjectTypeFromDir;
export const getDirFromObjectType = utils.getDirFromObjectType;
export const getObjectTypes = utils.getObjectTypes;
export const getDirTypes = utils.getDirTypes;
