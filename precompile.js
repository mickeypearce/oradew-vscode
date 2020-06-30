const fs = require("fs-extra");
const del = require("del");

// Delete .out directory
del.sync("./out");

// copy templates/*
fs.copySync("./src/cli/templates", "./out/src/cli/templates");

// copy test resources
fs.copySync("./src/cli/test/resources", "./out/src/cli/test/resources");
