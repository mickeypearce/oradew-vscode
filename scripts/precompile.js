const fs = require("fs-extra");

// copy templates/*
fs.copySync("./src/config/templates", "./out/config/templates");
