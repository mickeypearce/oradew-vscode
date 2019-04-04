const fs = require("fs-extra");
const del = require("del");

// Delete .out directory
del.sync("./out");

// copy templates/*
fs.copySync("./src/templates", "./out/templates");

// copy test resources
fs.copySync("./src/test/resources", "./out/test/resources");
