// const glob = require("glob");
// const glob = require("globby");
const glob = require("fast-glob");

import { rootPrepend } from "./utility";

// Get array of files matched by glob patterns array
export function fromGlobsToFilesArray(globArray, options) {
  return glob.sync(globArray, options).map(rootPrepend);
}
