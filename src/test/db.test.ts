const assert = require("assert");

import { getDefaultsFromSchema, dbConfig, DBConfig } from "../common/config";

const templateDbconfig = require("./resources/dbconfig.default.json");

describe("#db getConfiguration", function() {
  it("should return default cfg", function() {
    let cfg = {
      env: "DEV",
      connectString: "localhost/orclpdb",
      user: "hr",
      password: "welcome"
    };
    let cfgNonUser = dbConfig.getConfiguration("DEV", "XXX");
    assert.deepEqual(cfgNonUser, cfg);

    // No user parameter
    let cfgNullUser = dbConfig.getConfiguration("DEV");
    assert.deepEqual(cfgNullUser, cfg);

    // Also empty user parameter should be same result
    let cfgEmptyUser = dbConfig.getConfiguration("DEV", "");
    assert.deepEqual(cfgEmptyUser, cfg);
  });
});

describe("#DBConfig", function() {
  const dbconfig = dbConfig;
  const defaults = getDefaultsFromSchema(
    "../../resources/dbconfig-schema.json"
  );

  it("should extract defaults from schema", function() {
    assert.deepEqual(defaults, templateDbconfig);
  });

  it("should get defaults from dbConfigInstance", function() {
    assert.deepEqual(dbconfig.object, templateDbconfig);
  });

  it("should return all distinct dev users", function() {
    let users = dbconfig.getSchemas();
    assert.deepEqual(users, ["HR"]);
  });

  // it("should return connectString", function() {
  //   let connectString = dbconfig.getConnectString("DEV");
  //   assert.deepEqual(connectString, defaults.DEV.connectString);
  // });

  // it("should return usersObjects", function() {
  //   let connectString = dbconfig.getUserObjects("DEV");
  //   assert.deepEqual(connectString, defaults.DEV.users);
  // });

  let cfgDefault = {
    env: "DEV",
    connectString: "oradew",
    user: "dev1",
    password: "welcome1",
    default: true,
    disabled: false
  };

  let cfgUser = {
    env: "DEV",
    connectString: "oradew",
    user: "dev",
    password: "welcome",
    schemas: ["schema1", "schema2"]
  };

  const dbConfigInstance1 = new DBConfig(
    "./src/test/resources/dbconfig.json"
  );

  it("should get all schemas from Custom file", function() {
    let users = dbConfigInstance1.getSchemas();
    assert.deepEqual(users, ["SCHEMA1", "SCHEMA2", "DEV1"]);
  });

  it("should get default different configurations", function() {
    // get default, null user
    let cfgDefaultActual = dbConfigInstance1.getConfiguration("DEV");
    assert.deepEqual(cfgDefaultActual, cfgDefault);

    // get default, non existing user
    cfgDefaultActual = dbConfigInstance1.getConfiguration("DEV", "bla");
    assert.deepEqual(cfgDefaultActual, cfgDefault);

    // get default, disabled user
    let cfgUserActualDisabled = dbConfigInstance1.getConfiguration(
      "DEV",
      "dev2"
    );
    assert.deepEqual(cfgUserActualDisabled, cfgDefault);

    // get configuration by existing user
    let cfgUserActual = dbConfigInstance1.getConfiguration("DEV", "dev");
    assert.deepEqual(cfgUserActual, cfgUser);

    // get configuration by schema - case insensitive!
    let cfgSchemaActual = dbConfigInstance1.getConfiguration("DEV", "schEma2");
    assert.deepEqual(cfgSchemaActual, cfgUser);
  });
});
