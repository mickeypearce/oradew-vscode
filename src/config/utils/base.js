const exec = require("child_process").exec;
const fs = require("fs-extra");

const _ = require("lodash/fp");
const glob = require("glob");
const stripJson = require("strip-json-comments");
const resolve = require("path").resolve;

const utils = require("./utility");
const db = require("./db");

let obj = {};

class Config {
  constructor(file) {
    this.file = file || "./oradewrc.json";
    this.object = null;
    // @TODO error handling when ther is no config file
    // this.load();
  }

  load() {
    this.object = JSON.parse(stripJson(fs.readFileSync(this.file, "utf8")));
  }
  save() {
    return fs.outputJsonSync(this.file, this.object);
  }
  get(field) {
    if (!this.object) this.load();
    return field ? this.object[field] : this.object;
  }
  set(field, value) {
    this.object[field] = value;
  }
}
obj.config = new Config();

// ////////
// Get array of files from output stream string
obj.fromStdoutToFilesArray = stdout =>
  _.pipe(
    // Git returns posix style path separators, replace..
    _.replace(/[/]/g, "\\"),
    // Generate array from lines
    _.split("\n"),
    // Remove empty items and duplicates
    _.compact,
    _.uniq,
    // Scripts first
    _.sortBy(_.identity),
    // Add .\\ to path
    _.map(val => `.\\${val}`)
  )(stdout);

// Get array of files matched by glob patterns array
obj.fromGlobsToFilesArray = globArray => {
  return globArray
    .reduce((acc, path) => acc.concat(glob.sync(path)), [])
    .map(_.replace(/[/]/g, "\\"));
};

// Check if file is matched by source glob array
obj.isSourceFile = file => {
  const srcArray = obj.fromGlobsToFilesArray(obj.config.get("source"));
  // Resolve to absolute paths of files
  return srcArray.map(srcFile => resolve(srcFile)).includes(resolve(file));
};

// ////////

obj.exportFile = async (code, file, env, ease = false, done) => {
  const obj = utils.getDBObjectFromPath(file);

  let exported = null;
  let conn;
  try {
    conn = await db.getConnection(env);
    try {
      if (!ease || (await db.isDifferentDdlTime(conn, obj))) {
        // Get Db object code as string
        let lob = await db.getObjectDdl(conn, obj);
        lob = _.pipe(
          // Remove whitespaces
          _.trim,
          // Remove NUL chars that are added to large files ?!
          _.replace(/\x00/g, "")
        )(lob);
        // Return a value async with callback
        done(null, lob);
        // Mark object as exported
        await db.syncDdlTime(conn, obj);
        exported = true;
      } else {
        // Return local code to continue gulp pipe
        done(null, code);
        exported = false;
      }
    } catch (error) {
      console.error(error.message);
    }
  } catch (error) {
    console.error(error.message);
  } finally {
    conn && conn.close();
  }
  return { exported };
};

obj.compileFile = async (code, file, env, force = false, scope) => {
  const obj = utils.getDBObjectFromPath(file);

  // Trim empties and slash (/) from code if it exists
  code = _.pipe(_.trim, _.trimCharsEnd("/"))(code);

  let errors = {};
  let result = {};
  let conn;
  try {
    conn = await db.getConnection(env);
    try {
      // Generate error if we havent the latest obj version
      // and we arent forcing compile
      if ((await db.isDifferentDdlTime(conn, obj)) && !force) {
        errors = db.getErrorObjectChanged();
      } else {
        // Otherwise compile object to Db with warning scope
        result = await db.compile(conn, code.toString(), scope);
        // Mark object as exported as we have the latest version
        if (!force) await db.syncDdlTime(conn, obj);
        // Getting errors for this object from Db
        errors = await db.getErrors(conn, obj);
      }
    } catch (error) {
      errors = db.getErrorSystem(error.message);
    }
  } catch (error) {
    console.error(error.message);
  } finally {
    conn && conn.close();
  }
  // Return results, errors array, file and env params
  return {
    file,
    env,
    errors,
    result
  };
};

obj.deployFile = (file, env, done) => {
  const connString = db.getConnectionString(env);
  const cmd = `(echo connect ${connString} & echo start ${file} & echo show errors) | sqlplus -S /nolog`;
  exec(cmd, done);
};

obj.getObjectsInfoByType = async (env, objectTypes) => {
  let conn;
  let result = [];
  const owner = db.getUser(env);
  try {
    conn = await db.getConnection(env);
    for (let objectType of objectTypes) {
      const objects = await db.getObjectsInfo(conn, { owner, objectType });
      result = result.concat(objects);
    }
  } catch (error) {
    throw error;
  } finally {
    conn && conn.close();
  }
  return result;
};

module.exports = obj;
