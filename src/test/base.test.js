const assert = require("assert");
const base = require("../common/base");

describe("#base", function() {
  it("fromGlobsToFilesArray", function() {
    let matches = [
      "./test/src/FUNCTIONS/FUNC_TEST.sql",
      "./test/src/FUNCTIONS/FUNC_TEST1.sql"
    ];
    let match = base.fromGlobsToFilesArray(["./test/src/**/*.sql"]);
    assert.deepEqual(match, matches);
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
  });
});
