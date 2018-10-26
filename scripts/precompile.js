const fs = require("fs-extra");

// copy templates/*
fs.copySync("./src/templates", "./out/templates");

// copy test resources
fs.copySync("./src/test/resources", "./out/test/resources");
