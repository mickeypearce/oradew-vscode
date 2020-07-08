const assert = require("assert");

import { fromGlobsToFilesArray, getGlobMatches, isGlobMatch } from "../common/globs";
// import { resolve } from "path";

const dir = "./out/src/cli/test/testWorkspace"; //resolve(__dirname, "testWorkspace");

describe("#base", function () {
  it("fromGlobsToFilesArray", function () {
    let matches = [
      dir + "/src/HR/FUNCTIONS/FUNC_TEST.sql",
      dir + "/src/HR/FUNCTIONS/FUNC_TEST1.sql",
    ];
    let match = fromGlobsToFilesArray([dir + "/src/**/*.sql"]);
    assert.deepEqual(match, matches);
  });
  it("getGlobMatches", function () {
    let matches = [
      dir + "/src/HR/FUNCTIONS/FUNC_TEST.sql",
      dir + "/src/HR/FUNCTIONS/FUNC_TEST1.sql",
    ];
    let match = getGlobMatches([dir + "/src/**/*.sql"], matches);
    assert.deepEqual(match, matches);

    let matchesNot = ["./test/src/HR/FUNCTIONS/FUNC_TEST.sql"];
    let matchNot = getGlobMatches(
      ["./test/src/**/*.sql", "!./test/src/HR/FUNCTIONS/FUNC_TEST1.sql"],
      matchesNot
    );
    assert.deepEqual(matchNot, matchesNot);
  });
  it("isGlobMatch", function () {
    const matches = ["./test/src/FUNCTIONS/FUNC_TEST1.sql"];
    let match = isGlobMatch(["./test/src/**/*.sql"], matches);
    assert.ok(match);

    let matchcase = isGlobMatch(["./test/src/**/*.SQL"], matches);
    assert.ok(matchcase);
    // Exclude file from glob
    let matchIgnore = isGlobMatch(["./test/src/**/*.sql", `!./test/src/FUNCTIONS/*.sql`], matches);
    assert.ok(!matchIgnore);

    const matchesNotActualFile = ["./test/src/USERX/FUNCTIONS/FUNC_TEST1.sql"];
    let matchNotActualFile = isGlobMatch(["./test/src/**/*.sql"], matchesNotActualFile);
    assert.ok(matchNotActualFile);
  });
});
