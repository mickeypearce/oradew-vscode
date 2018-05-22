let utils = {};

const owner = require("./db").getUser("DEV");

let mapDirToObjectType = {
  PACKAGES: "PACKAGE",
  PROCEDURES: "PROCEDURE",
  FUNCTIONS: "FUNCTION",
  PACKAGE_BODIES: "PACKAGE BODY",
  VIEWS: "VIEW",
  TRIGGERS: "TRIGGER"
};

let mapObjectTypeAlternative = {
  PACKAGE: "PACKAGE_SPEC",
  "PACKAGE BODY": "PACKAGE_BODY"
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

// Get object name from filepath
utils.getObjectNameFromPath = path => {
  return path
    .split("\\")
    .pop()
    .split(".")
    .shift();
};

utils.getDirFromPath = path => {
  return path
    .split("\\")
    .slice(0, -1)
    .pop();
};

// Not proud, @TODO refactor!
utils.getRootFromPath = path => owner;

// @TODO optimize!
utils.getDBObjectFromPath = path => {
  const owner = utils.getRootFromPath(path);
  const objectName = utils.getObjectNameFromPath(path);
  const dir = utils.getDirFromPath(path);
  const objectType = utils.getObjectTypeFromDir(dir);
  const objectType1 = utils.getObjectType1FromObjectType(objectType);
  return {
    owner,
    objectName,
    objectType,
    objectType1
  };
};

module.exports.getDBObjectFromPath = utils.getDBObjectFromPath;
module.exports.getObjectTypeFromDir = utils.getObjectTypeFromDir;
module.exports.getDirFromObjectType = utils.getDirFromObjectType;
module.exports.getObjectTypes = utils.getObjectTypes;
module.exports.getRootFromPath = utils.getRootFromPath;
module.exports.getDirTypes = utils.getDirTypes;
