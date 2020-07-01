const assert = require("assert");
import { includesCaseInsensitive } from "../common/utility";
import { WorkspaceConfig, getDefaultsFromSchema } from "../common/config";

const configDefault = new WorkspaceConfig();
const configCustomrc = new WorkspaceConfig(__dirname + "/resources/oradewrc.json");

const templateOradewrc = require(__dirname + "/resources/oradewrc.default.json");

import { properties as wsConfSchema } from "../schemas/oradewrc-schema.json";

describe("#Utility Default Config in ./", function () {
  it("should extract defaults from schema", function () {
    const defaults = getDefaultsFromSchema(wsConfSchema);
    assert.deepEqual(defaults, templateOradewrc);
  });

  it("should compile.force be true by default", function () {
    let force = configDefault.get("compile.force");
    assert.equal(force, true);
  });
  it("should test.input be ... by default", function () {
    let testInput = configDefault.get("test.input");
    assert.deepEqual(testInput, ["./test/**/*.test.sql"]);
  });
});

describe("#Utility Config", function () {
  it("should package.templating be false by default", function () {
    let tmp = configCustomrc.get("package.templating");
    assert.equal(tmp, false);
  });
  it("should compile.force be true from base config", function () {
    let force = configCustomrc.get("compile.force");
    assert.equal(force, true);
  });
  it("should get custom field from base config", function () {
    let custom = configCustomrc.get("customField");
    assert.equal(custom, "this is it.");
  });
  it("should get custom field from TEST config", function () {
    let custom = configCustomrc.get({ field: "customField", env: "TEST" });
    assert.equal(custom, "no this.");
  });
  it("should get compile.force from TEST, actually from base", function () {
    let custom = configCustomrc.get({ field: "compile.force", env: "TEST" });
    assert.equal(custom, true);
  });
  it("should get package.templating from TEST, actually from default", function () {
    let tmp = configCustomrc.get({ field: "package.templating", env: "TEST" });
    assert.equal(tmp, false);
  });
});

describe("#includesCaseInsensitive", function () {
  it("should return whether array contains string - case insensitive", function () {
    assert.equal(includesCaseInsensitive(["A"], "a"), true);
    assert.equal(includesCaseInsensitive(["A", "b"], "a"), true);
    assert.equal(includesCaseInsensitive(["A", "b"], "A"), true);
    assert.equal(includesCaseInsensitive(["A"], "1"), false);
    assert.equal(includesCaseInsensitive([], "1"), false);
  });
});
