const assert = require("assert");
const db = require("../config/utils/base");

// describe("#db", function() {
//   it("should return all distinct dev users", function() {
//     let users = db.getUsers();
//     assert.deepEqual(users, ["HR", "HR1"]);
//   });

//   it("should return default cfg", function() {
//     let cfg = {
//       env: "DEV",
//       connectString: "localhost/orclpdb",
//       user: "hr1",
//       password: "welcome1",
//       default: true
//     };
//     let cfgNonUser = db.getConfiguration("DEV", "XXX");
//     assert.deepEqual(cfgNonUser, cfg);

//     let cfgNullUser = db.getConfiguration("DEV");
//     assert.deepEqual(cfgNullUser, cfg);
//   });
// });
