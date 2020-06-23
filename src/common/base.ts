import { pipe, replace, trim, trimCharsEnd } from "lodash/fp";
import { parse } from "path";

import * as db from "./db";
import { splitLines, execPromise } from "./utility";
import { getObjectInfoFromPath } from "./dbobject";
import { dbConfig } from "./config";

const U_AUTO = "<Auto>";

/**
 *Extract user info from path and match with DB conn configuration
 */
function matchDbUser(file, env, user, changeOwner) {
  let obj = user === U_AUTO ? getObjectInfoFromPath(file) : { owner: user };
  // console.log('user='+user+ ' owner='+obj.owner);
  const connCfg = dbConfig.getConfiguration(env, obj.owner);
  // When there is no user configuration for the owner
  // we force change the object owner to default user
  if (changeOwner) {
    obj.owner = connCfg.user.toUpperCase();
  }
  return { obj, connCfg };
}

// let obj = {};

export const exportFile = async (code, file, env, ease, getFunctionName, done) => {
  let exported = null;
  let conn;
  let obj, connCfg;
  try {
    ({ obj, connCfg } = matchDbUser(file, env, U_AUTO, false));

    conn = await db.getConnection(connCfg);
    // try {
    if (!ease || (await db.isDifferentDdlTime(conn, obj, env))) {
      // Get Db object code as string
      let lob = await db.getObjectDdl(conn, getFunctionName, obj);
      lob = pipe(
        // Remove whitespaces
        trim,
        // Remove NUL chars that are added to large files ?!
        replace(/\x00/g, ""),
        // Remove disable/enable line that is added at the end of the trigger
        replace(/\nALTER TRIGGER+.*/g, "")
      )(lob);
      // Return a value async with callback
      done(null, lob);
      // Mark object as exported
      await db.syncDdlTime(conn, obj, env);
      exported = true;
    } else {
      // Return local code to continue gulp pipe
      done(null, code);
      exported = false;
      //   }
      // } catch (error) {
      //   console.error(error.message);
    }
  } catch (error) {
    console.error(error.message);
    done(null, code);
    exported = false;
  } finally {
    db.closeConnection(conn);
  }
  return { obj, exported };
};

function simpleParse(code) {
  // Trim empties and slash (/) from code if it exists
  code = pipe(trim, trimCharsEnd("/"), trim)(code);

  // Trim semicolon (;) if it doesn't end with "END;" or "END <name>; etc"
  if (!/END(\s*\w*);$/gi.test(code)) {
    code = trimCharsEnd(";")(code);
  }
  return code;
}

function getLineAndPosition(code, offset) {
  let lines = splitLines(code.substring(0, offset));
  let line = lines.length;
  let position = lines.pop().length + 1;
  return { line, position };
}

export const compileFile = async (code, file, env, force, warnings, user = U_AUTO) => {
  const { obj, connCfg } = matchDbUser(file, env, user, true);

  code = simpleParse(code);

  let errors;
  let lines = [];
  let result = {};
  let conn;
  try {
    conn = await db.getConnection(connCfg);
    // Generate error if we havent the latest obj version
    // and we arent forcing compile
    if ((await db.isDifferentDdlTime(conn, obj, env)) && !force) {
      errors = db.getErrorObjectChanged();
    } else {
      // Otherwise compile object to Db with warning scope
      result = await db.compile(conn, code.toString(), warnings);
      // Mark object as exported as we have the latest version
      await db.syncDdlTime(conn, obj, env);
      // Getting errors for this object from Db
      errors = await db.getErrors(conn, obj);
      lines = await db.getDbmsOutput(conn);
    }
  } catch (error) {
    const { line, position } = getLineAndPosition(code, error.offset);
    let msg = error.message;
    errors = db.getErrorSystem(msg, 1, line, position);
  } finally {
    db.closeConnection(conn);
  }
  // Return results, errors array, file and env params
  return {
    obj,
    file,
    env,
    errors,
    result,
    lines,
  };
};

export const compileSelection = async (code, file, env, lineOffset, user = U_AUTO) => {
  const { obj, connCfg } = matchDbUser(file, env, user, true);

  code = simpleParse(code);

  let errors;
  let lines = [];
  let result = {};
  let conn;

  try {
    conn = await db.getConnection(connCfg);
    result = await db.compile(conn, code.toString());
    errors = db.createErrorList();
    lines = await db.getDbmsOutput(conn);
  } catch (error) {
    // Oracle returns character offset of error
    const { line, position } = getLineAndPosition(code, error.offset);
    let msg = error.message;
    errors = db.getErrorSystem(msg, lineOffset, line, position);
  } finally {
    db.closeConnection(conn);
  }
  // Return results, errors array, file and env params
  // dbmsoutput lines
  return {
    obj,
    file,
    env,
    errors,
    result,
    lines,
  };
};

export const runFileAsScript = async (file, env, user = U_AUTO) => {
  const { obj, connCfg } = matchDbUser(file, env, user, true);

  const connString = await db.getConnectionString(connCfg);

  const cwd = parse(file).dir;
  const filename = parse(file).base;
  const cli = process.env.ORADEW_CLI_EXECUTABLE;

  const isSqlPlus = parse(cli).name.toLowerCase() === "sqlplus";
  let cmd;
  if (isSqlPlus) {
    cmd = `(echo connect ${connString} && echo start ${filename} && echo show errors) | "${cli}" -S /nolog`;
  } else {
    cmd = `exit | "${cli}" -S ${connString} @"${filename}"`;
  }

  // We execute from file directory (change cwd)
  // mainly because of spooling to dir of the file (packaged script)
  // buffer: 5MB
  let stdout = await execPromise(cmd, { maxBuffer: 1024 * 5000, cwd });
  return { stdout, obj };
};

export const getObjectsInfoByType = async (env, owner, objectTypes) => {
  const connCfg = dbConfig.getConfiguration(env, owner);
  let conn;
  let result = [];
  try {
    conn = await db.getConnection(connCfg);
    for (let objectType of objectTypes) {
      const objects = await db.getObjectsInfo(conn, { owner, objectType });
      result = result.concat(objects);
    }
  } catch (error) {
    throw error;
  } finally {
    db.closeConnection(conn);
  }
  return result;
};

export const resolveObjectInfo = async (env, objName, user = U_AUTO, file) => {
  let { connCfg } = matchDbUser(file, env, user, false);

  let conn;
  let result;
  let conn1;
  try {
    let schema, part1, part2;
    let objectName;
    conn = await db.getConnection(connCfg);
    // Try to resolve object name for every context [0..9] (obj type)
    for (let context = 0; context < 10; context++) {
      try {
        ({ schema, part1, part2 } = await db.getNameResolve(conn, {
          name: objName,
          context,
        }));
      } catch (error) {
        // Triggers throw 06564 if not correct context (3)?
        // ORA-06564: object does not exist
        // ORA-04047: object specified is incompatible with the flag specified
        if (![6564, 4047].includes(error.errorNum)) {
          throw error;
        }
      }
      // Break if we got objectName
      objectName = part1 || part2;
      if (objectName) {
        break;
      }
    }

    if (!objectName) {
      throw Error(`object ${objName} does not exist for user ${user}.`);
    }

    // Get connection to object actual schema
    connCfg = dbConfig.getConfiguration(env, schema);
    conn1 = await db.getConnection(connCfg);
    result = await db.getObjectsInfo(conn1, {
      owner: schema,
      objectName,
    });
  } catch (error) {
    throw error;
  } finally {
    db.closeConnection(conn);
    db.closeConnection(conn1);
  }
  return result;
};

export const getGenerator = async ({ func, file, env, object, user = U_AUTO }) => {
  const { obj, connCfg } = matchDbUser(file, env, user, true);

  let result = {};
  let conn;
  try {
    conn = await db.getConnection(connCfg);
    result = await db.getGeneratorFunction(conn, func, obj, object);
  } catch (error) {
    throw error;
  } finally {
    db.closeConnection(conn);
  }
  return {
    obj,
    file,
    env,
    result,
  };
};
