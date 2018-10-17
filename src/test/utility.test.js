const assert = require("assert");
const utils = require("../config/utils/utility");

const configDefault = utils.config;
const configCustomrc = utils.createConfig("src/test/oradewrc.json");

describe("#Utility Default Config in ./", function() {
  it("should compile.force be false by default", function() {
    let force = configDefault.get("compile.force");
    assert.equal(force, false);
  });
});

describe("#Utility Config", function() {
  it("should package.templating be false by default", function() {
    let tmp = configCustomrc.get("package.templating");
    assert.equal(tmp, false);
  });
  it("should compile.force be true from base config", function() {
    let force = configCustomrc.get("compile.force");
    assert.equal(force, true);
  });
  it("should get custom field from base config", function() {
    let custom = configCustomrc.get("customField");
    assert.equal(custom, "this is it.");
  });
  it("should get custom field from TEST config", function() {
    let custom = configCustomrc.get({ field: "customField", env: "TEST" });
    assert.equal(custom, "no this.");
  });
  it("should get compile.force from TEST, actually from base", function() {
    let custom = configCustomrc.get({ field: "compile.force", env: "TEST" });
    assert.equal(custom, true);
  });
  it("should get package.templating from TEST, actually from default", function() {
    let tmp = configCustomrc.get({ field: "package.templating", env: "TEST" });
    assert.equal(tmp, false);
  });
});
