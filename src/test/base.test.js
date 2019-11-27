const assert = require("assert");
const base = require("../common/base");

describe("#base", function() {
  it("fromGlobsToFilesArray", function() {
    let matches = [
      "./test/src/HR/FUNCTIONS/FUNC_TEST.sql",
      "./test/src/HR/FUNCTIONS/FUNC_TEST1.sql"
    ];
    let match = base.fromGlobsToFilesArray(["./test/src/**/*.sql"]);
    assert.deepEqual(match, matches);
  });
  it("getGlobMatches", function() {
    let matches = [
      "./test/src/HR/FUNCTIONS/FUNC_TEST.sql",
      "./test/src/HR/FUNCTIONS/FUNC_TEST1.sql"
    ];
    let match = base.getGlobMatches(["./test/src/**/*.sql"], matches);
    assert.deepEqual(match, matches);

    let matchesNot = ["./test/src/HR/FUNCTIONS/FUNC_TEST.sql"];
    let matchNot = base.getGlobMatches(
      ["./test/src/**/*.sql", "!./test/src/HR/FUNCTIONS/FUNC_TEST1.sql"],
      matchesNot
    );
    assert.deepEqual(matchNot, matchesNot);
  });
  it("isGlobMatch", function() {
    const matches = ["./test/src/FUNCTIONS/FUNC_TEST1.sql"];
    let match = base.isGlobMatch(["./test/src/**/*.sql"], matches);
    assert.ok(match);

    // Exclude file from glob
    let matchIgnore = base.isGlobMatch(
      ["./test/src/**/*.sql", `!./test/src/FUNCTIONS/*.sql`],
      matches
    );
    assert.ok(!matchIgnore);

    const matchesNotActualFile = ["./test/src/USERX/FUNCTIONS/FUNC_TEST1.sql"];
    let matchNotActualFile = base.isGlobMatch(
      ["./test/src/**/*.sql"],
      matchesNotActualFile
    );
    assert.ok(matchNotActualFile);
  });
});
