const assert = require("assert");

import { getObjectInfo } from "../common/dbobject";

describe("#getObjectInfo with default structure", function () {
  it("src: should get object type body", function () {
    assert.deepEqual(getObjectInfo("./src/HR/PACKAGE_BODIES/my_pck1.sql"),
      { "owner": "HR", "objectType": "PACKAGE BODY", "objectType1": "PACKAGE_BODY", "objectName": "my_pck1", "isSource": true, "isScript": false });
  });
  it("src: should get object type spec", function () {
    assert.deepEqual(getObjectInfo("./src/HR/PACKAGES/my_pck1.sql"),
      { "owner": "HR", "objectType": "PACKAGE", "objectType1": "PACKAGE_SPEC", "objectName": "my_pck1", "isSource": true, "isScript": false });
  });
  it("script: should get object type script and schema", function () {
    assert.deepEqual(getObjectInfo("./scripts/HR/initial_dml.sql"),
      { "owner": "HR", "objectType": "script", "objectType1": "script", "objectName": "initial_dml", "isSource": false, "isScript": true });
  });
  it("deploy: should get object type script", function () {
    assert.deepEqual(getObjectInfo("./deploy/Release.sql"),
      { "owner": "", "objectType": "script", "objectType1": "script", "objectName": "Release", "isSource": false, "isScript": true });
  });
  it("script: should get object type script - no dir", function () {
    assert.deepEqual(getObjectInfo("./file.sql"),
      { "owner": "", "objectType": "script", "objectType1": "script", "objectName": "file", "isSource": false, "isScript": true });
  });
});

describe("#getObjectInfo with custom config", function () {
  // delete the cached module and reload with different config
  var decache = require('decache');
  decache("../common/dbobject");
  process.env['wsConfigPath'] = __dirname + "/resources/oradewrc.json";
  const getObjectInfo = require('../common/dbobject').getObjectInfo;

  it("src: should get object type body", function () {
    assert.deepEqual(getObjectInfo("./src/HR/pck/my_pck1-body.sql"),
      { "owner": "HR", "objectType": "PACKAGE BODY", "objectType1": "PACKAGE_BODY", "objectName": "my_pck1", "isSource": true, "isScript": false });
  });
  it("src: should get object type spec", function () {
    assert.deepEqual(getObjectInfo("./src/HR/pck/my_pck1-spec.sql"),
      { "owner": "HR", "objectType": "PACKAGE", "objectType1": "PACKAGE_SPEC", "objectName": "my_pck1", "isSource": true, "isScript": false });
  });
  it("src: should get object type trigger", function () {
    assert.deepEqual(getObjectInfo("./src/HR/trigger-my_trg.sql"),
      { "owner": "HR", "objectType": "TRIGGER", "objectType1": "TRIGGER", "objectName": "my_trg", "isSource": true, "isScript": false });
  });
  it("src: should get object type view", function () {
    assert.deepEqual(getObjectInfo("./src/HR/view-my_trg.sql"),
      { "owner": "HR", "objectType": "VIEW", "objectType1": "VIEW", "objectName": "my_trg", "isSource": true, "isScript": false });
  });
  it("src: should get object type function without schema", function () {
    assert.deepEqual(getObjectInfo("./src/FUNCTIONS/func1.sql"),
      { "owner": "", "objectType": "FUNCTION", "objectType1": "FUNCTION", "objectName": "func1", "isSource": true, "isScript": false });
  });
});