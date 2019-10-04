const assert = require("assert");

import { resolve } from "path";

import { getObjectInfoFromPath, getPathFromObjectInfo, getStructure } from "../common/dbobject";

describe("#getObjectInfo with default structure", function () {
  it("src: should get object type body", function () {
    assert.deepEqual(getObjectInfoFromPath("./src/HR/PACKAGE_BODIES/my_pck1.sql"),
      { "owner": "HR", "objectType": "PACKAGE BODY", "objectType1": "PACKAGE_BODY", "objectName": "my_pck1", "isSource": true, "isScript": false });
  });
  it("src: should get object type spec", function () {
    assert.deepEqual(getObjectInfoFromPath("./src/HR/PACKAGES/my_pck1.sql"),
      { "owner": "HR", "objectType": "PACKAGE", "objectType1": "PACKAGE_SPEC", "objectName": "my_pck1", "isSource": true, "isScript": false });
  });
  it("script: should get object type script and schema", function () {
    assert.deepEqual(getObjectInfoFromPath("./scripts/HR/initial_dml.sql"),
      { "owner": "HR", "objectType": "script", "objectType1": "script", "objectName": "initial_dml", "isSource": false, "isScript": true });
  });
  it("deploy: should get object type script", function () {
    assert.deepEqual(getObjectInfoFromPath("./deploy/Release.sql"),
      { "owner": "", "objectType": "script", "objectType1": "script", "objectName": "Release", "isSource": false, "isScript": true });
  });
  it("script: should get object type script - no dir", function () {
    assert.deepEqual(getObjectInfoFromPath("./file.sql"),
      { "owner": "", "objectType": "script", "objectType1": "script", "objectName": "file", "isSource": false, "isScript": true });
  });

  it("src: should get object type body - windows sep", function () {
    assert.deepEqual(getObjectInfoFromPath(".\\src\\HR\\PACKAGE_BODIES\\my_pck1.sql"),
      { "owner": "HR", "objectType": "PACKAGE BODY", "objectType1": "PACKAGE_BODY", "objectName": "my_pck1", "isSource": true, "isScript": false });
  });
});

describe("#getPath from default structure", function () {
  it("should get dir structure for packages", function () {
    assert.deepEqual(getPathFromObjectInfo("HR", "PACKAGE BODY", "my_pck1"), './src/HR/PACKAGE_BODIES/my_pck1.sql');
    assert.deepEqual(getPathFromObjectInfo("HR", "PACKAGE", "my_pck1"), './src/HR/PACKAGES/my_pck1.sql');
  });
});


describe("#getObjectInfo with custom config", function () {
  // delete the cached module and reload with different config
  var decache = require('decache');
  decache("../common/dbobject");
  process.env['wsConfigPath'] = __dirname + "/resources/oradewrc.json";
  const getObjectInfoFromPath = require('../common/dbobject').getObjectInfoFromPath;

  it("src: should get object type body", function () {
    assert.deepEqual(getObjectInfoFromPath("./src/HR/pck/my_pck1-body.sql"),
      { "owner": "HR", "objectType": "PACKAGE BODY", "objectType1": "PACKAGE_BODY", "objectName": "my_pck1", "isSource": true, "isScript": false });
  });
  it("src: should get object type spec", function () {
    assert.deepEqual(getObjectInfoFromPath("./src/HR/pck/my_pck1-spec.sql"),
      { "owner": "HR", "objectType": "PACKAGE", "objectType1": "PACKAGE_SPEC", "objectName": "my_pck1", "isSource": true, "isScript": false });
  });
  it("src: should get object type trigger", function () {
    assert.deepEqual(getObjectInfoFromPath("./src/HR/trigger-my_trg.sql"),
      { "owner": "HR", "objectType": "TRIGGER", "objectType1": "TRIGGER", "objectName": "my_trg", "isSource": true, "isScript": false });
  });
  it("src: should get object type view", function () {
    assert.deepEqual(getObjectInfoFromPath("./src/HR/view-my_trg.sql"),
      { "owner": "HR", "objectType": "VIEW", "objectType1": "VIEW", "objectName": "my_trg", "isSource": true, "isScript": false });
  });
  it("src: should get object type function without schema", function () {
    assert.deepEqual(getObjectInfoFromPath("./src/PROCEDURES/func1.sql"),
      { "owner": "", "objectType": "PROCEDURE", "objectType1": "PROCEDURE", "objectName": "func1", "isSource": true, "isScript": false });
  });
  it("src: should get object type body from ABSOLUTE path", function () {
    assert.deepEqual(getObjectInfoFromPath(resolve("test/src/HR/FUNCTIONS/FUNC_TEST.sql")),
      { "owner": "HR", "objectType": "FUNCTION", "objectType1": "FUNCTION", "objectName": "FUNC_TEST", "isSource": true, "isScript": false });
  });
  it("src: should get object type body from ABSOLUTE path - windows sep", function () {
    assert.deepEqual(getObjectInfoFromPath(resolve("test\\src\\HR\\FUNCTIONS\\FUNC_TEST.sql")),
      { "owner": "HR", "objectType": "FUNCTION", "objectType1": "FUNCTION", "objectName": "FUNC_TEST", "isSource": true, "isScript": false });
  });
});

describe("#getPath from custom structure", function () {
  // delete the cached module and reload with different config
  var decache = require('decache');
  decache("../common/dbobject");
  process.env['wsConfigPath'] = __dirname + "/resources/oradewrc.json";
  const getPathFromObjectInfo = require('../common/dbobject').getPathFromObjectInfo;
  it("should get custom dir structure for packages", function () {
    assert.deepEqual(getPathFromObjectInfo("HR", "PACKAGE BODY", "my_pck1"), './src/HR/pck/my_pck1-body.sql');
    assert.deepEqual(getPathFromObjectInfo("HR", "PACKAGE", "my_pck1"), './src/HR/pck/my_pck1-spec.sql');
  });
});


describe("#getStructure", function () {
  it("should get default structure", function () {
    assert.deepEqual(getStructure(), [
      "./src/{schema-name}/PACKAGES",
      "./src/{schema-name}/PACKAGE_BODIES",
      "./src/{schema-name}/TRIGGERS",
      "./src/{schema-name}/TYPES",
      "./src/{schema-name}/TYPE_BODIES",
      "./src/{schema-name}/VIEWS",
      "./src/{schema-name}/FUNCTIONS",
      "./src/{schema-name}/PROCEDURES",
      "./src/{schema-name}/TABLES"
    ]);
  });
});
