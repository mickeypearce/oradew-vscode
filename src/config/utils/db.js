// process.env["PATH"] = "C:\\oracle\\instantclient" + ";" + process.env["PATH"];
// import { join } from "path";
const oracledb = require("oracledb");
const _ = require("lodash/fp");

import { readJsonSync } from "fs-extra";

const dbLoc = require("./nedb");

/**
 * Connection config object from dbConfig.json
 * @typedef {{env: string, user: string, password: string, connectString: string, default: ?boolean}} ConnectionConfig
 */

var dbConfig;
try {
  dbConfig = readJsonSync("./dbconfig.json");
} catch (e) {
  // Require scope is in ext folder
  dbConfig = require("../templates/dbconfig.json");
}

// Each env has its own pool with users
let _pool = {};
_pool.DEV = {};
_pool.TEST = {};
_pool.UAT = {};

/**
 ** Get connection configuration from dbConfig.
 * @param {string} env
 * @param {?string} user
 * @returns {ConnectionConfig} Connection config
 */
const getConfiguration = (env, user) => {
  if (!env) throw Error(`No env.`);

  // First filter by env, if only one config return
  let byEnv = _.filter({ env })(dbConfig);

  if (byEnv.length === 0) {
    throw Error(`dbconfig.json: No user for "${env}" env.`);
  }
  if (byEnv.length === 1) {
    return byEnv[0];
  }

  // If user exist filter env by user, if only one return
  let byUser = user
    ? _.filter(v => v.user.toUpperCase() === user)(byEnv)
    : byEnv;

  if (byUser.length === 1) {
    return byUser[0];
  }
  // non existing user -> go for default
  // if (byUser.length === 0) {
  //   byUser = byEnv;
  // }

  // We couldn't match by user so go for default for env
  let byDefault = _.filter({ default: true })(byEnv);

  if (byDefault.length === 1) {
    return byDefault[0];
  } else {
    throw Error(
      `dbconfig.json: No default connection configuration for "${env}" env.`
    );
  }

  // let res = byUser;
  // if (res.length > 1) {
  //   res = _.filter({ default: true })(res);
  //   if (res.length == 0) {
  //     res = byUser;
  //   }
  // }

  // // filter by env and user
  // let res = _.pipe(
  //   _.filter({ env }),
  //   _.filter(v => v.user.toUpperCase() === user)
  // )(dbConfig);

  // // If not succesfull filter by default
  // if (res.length !== 1) {
  //   res = _.pipe(
  //     _.filter({ env }),
  //     _.filter({ default: true })
  //   )(dbConfig);
  // }

  // if (res.length !== 1)
  //   throw Error(
  //     `dbconfig.json: No connection (default) config for user ${user} (${env} environment).`
  //   );
  // console.log(res[0]);
  // return res[0];
};

/**
 ** Return existing connection from pool or creates a new one.
 * @param {ConnectionConfig} connCfg
 */
const getConnection = connCfg => {
  let { env, user, password, connectString } = connCfg;
  if (_pool[env][user]) {
    return _pool[env][user].getConnection();
  }
  return oracledb
    .createPool({
      user,
      password,
      connectString
    })
    .then(newPool => {
      _pool[env][user] = newPool;
      return _pool[env][user].getConnection();
    });
};

/**
 ** Return connection string.
 * @param {ConnectionConfig} connCfg
 */
const getConnectionString = connCfg => {
  return `${connCfg.user}/${connCfg.password}@${connCfg.connectString}`;
};

// TODO default maybe
const getUser = env => dbConfig[env].user.toUpperCase();

const getUsers = (env = "DEV") => {
  return _.pipe(
    _.filter({ env }),
    _.map(v => v.user.toUpperCase()),
    _.uniq
  )(dbConfig);
};

const compile = (connection, code, warningScope = "NONE") => {
  oracledb.outFormat = oracledb.ARRAY;
  if (warningScope.toUpperCase() === "NONE") {
    return connection.execute(code);
  }
  return connection
    .execute(
      `call dbms_warning.set_warning_setting_string ('ENABLE:${warningScope}', 'SESSION')`
    )
    .then(() => connection.execute(code));
};

const getObjectDdl = (connection, { owner, objectName, objectType1 }) => {
  oracledb.fetchAsString = [oracledb.CLOB];
  oracledb.outFormat = oracledb.ARRAY;
  return connection
    .execute(
      `select
      dbms_metadata.get_ddl(:objectType1, :objectName, :owner)
      from dual`,
      {
        owner,
        objectName,
        objectType1
      }
    )
    .then(result => result.rows[0][0]);
};

const getErrorsInfo = (connection, { owner, objectName, objectType }) => {
  oracledb.outFormat = oracledb.OBJECT;
  oracledb.maxRows = 150;
  // Flatten multi-lines text to one-line error
  // as problem matcher cannot parse multi-line
  return connection
    .execute(
      `select line, position, attribute, replace(text, CHR(10), '') text
    from all_errors
    where owner = :owner
    and type = nvl(:objectType, type)
    and name = nvl(:objectName, name)
    order by sequence desc`,
      {
        owner,
        objectName,
        objectType
      }
    )
    .then(result => result.rows);
};

const getObjectsInfo = (connection, { owner, objectType, objectName }) => {
  // Exclude types that are silently created when defined in packages (SYS_PLSQL)
  oracledb.outFormat = oracledb.OBJECT;
  return connection
    .execute(
      `select owner, object_id, object_name, object_type, last_ddl_time, status
    from all_objects
    where owner = :owner
    and object_type = nvl(:objectType, object_type)
    and object_name = nvl(:objectName, object_name)
    and object_name not like 'SYS_PLSQL%'
    order by object_id`,
      {
        owner,
        objectName,
        objectType
      }
    )
    .then(result => result.rows);
};

const getLastDdlTime = async (conn, obj) => {
  let all = await getObjectsInfo(conn, obj);
  return all.length !== 0 ? all[0].LAST_DDL_TIME : 0;
};

const isDifferentDdlTime = async (conn, obj) => {
  let timeOracle = await getLastDdlTime(conn, obj);
  let timeLocal = await dbLoc.getDdlTime(obj);
  return timeLocal.toLocaleString() !== timeOracle.toLocaleString();
};

const syncDdlTime = async (conn, obj) => {
  let timeOracle = await getLastDdlTime(conn, obj);
  return await dbLoc.upsertDdlTime(obj, timeOracle);
};

const error = ({ LINE, POSITION, ATTRIBUTE, TEXT, _ID }) => ({
  isError: () => ATTRIBUTE === "ERROR",
  isWarning: () => ATTRIBUTE === "WARNING",
  isInfo: () => ATTRIBUTE === "INFO",
  isDirty: () => _ID === "0001",
  toString: () => `${LINE}/${POSITION} ${ATTRIBUTE} ${TEXT}`
});

const errors = (arr = []) => {
  let _arr = [];
  // Construct errors from input array
  arr.forEach(err => _arr.push(error(err)));
  let obj = {
    add: err => {
      _arr.push(err);
      return obj;
    },
    get: () => _arr,
    hasErrors: () => _arr.some(err => err.isError()),
    hasWarnings: () => _arr.some(err => err.isWarning()),
    hasInfos: () => _arr.some(err => err.isInfo()),
    hasDirt: () => _arr.some(err => err.isDirty()),
    toString: () => _arr.map(err => err.toString()).join("\n")
  };
  return obj;
};

const getErrorSystem = msg => {
  return errors([
    {
      LINE: 1,
      POSITION: 1,
      TEXT: msg,
      ATTRIBUTE: "ERROR",
      _ID: "0002"
    }
  ]);
};

const getErrorObjectChanged = () => {
  return errors([
    {
      LINE: 1,
      POSITION: 1,
      TEXT:
        "Db Object has changed. Resolve any merge failure and compile again.",
      ATTRIBUTE: "ERROR",
      _ID: "0001"
    }
  ]);
};

const getErrors = async (conn, obj) => {
  let errsArray = await getErrorsInfo(conn, obj);
  return errors(errsArray);
};

const getNameResolve = (connection, { name, context }) => {
  return connection
    .execute(
      `begin
    dbms_utility.name_resolve (
    name          => :name,
    context       => :context,
    schema        => :schema,
    part1         => :part1,
    part2         => :part2,
    dblink        => :dblink,
    part1_type    => :part1_type,
    object_number => :object_number
    );
    end;`,
      {
        name,
        context,
        schema: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 30 },
        part1: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 30 },
        part2: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 30 },
        dblink: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 30 },
        part1_type: {
          dir: oracledb.BIND_OUT,
          type: oracledb.STRING,
          maxSize: 30
        },
        object_number: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
      }
    )
    .then(result => result.outBinds);
};

module.exports.getConfiguration = getConfiguration;
module.exports.getConnection = getConnection;
module.exports.getObjectDdl = getObjectDdl;
module.exports.getErrorsInfo = getErrorsInfo;
module.exports.getObjectsInfo = getObjectsInfo;
module.exports.getLastDdlTime = getLastDdlTime;
module.exports.syncDdlTime = syncDdlTime;
module.exports.getConnectionString = getConnectionString;
module.exports.isDifferentDdlTime = isDifferentDdlTime;
module.exports.compile = compile;
module.exports.getUser = getUser;
module.exports.error = error;
module.exports.errors = errors;
module.exports.getErrorObjectChanged = getErrorObjectChanged;
module.exports.getErrors = getErrors;
module.exports.getErrorSystem = getErrorSystem;
module.exports.getNameResolve = getNameResolve;
module.exports.getUsers = getUsers;
