const oracledb = require("oracledb");
const _ = require("lodash/fp");
const { readJsonSync, outputJsonSync } = require("fs-extra");

const dbLoc = require("./nedb");
const { getDefaultsFromSchema, IncludesCaseInsensitive } = require("./utility");

oracledb.fetchAsString = [oracledb.DATE, oracledb.CLOB];

export class DBConfig {
  constructor(fileBase) {
    // Defaults DB configuration object
    this.defaults = getDefaultsFromSchema(
      "../../resources/dbconfig-schema.json"
    );
    this.fileBase = fileBase || "./dbconfig.json";
    // DB config JSON Object
    this.object = null;
    this.load();
  }

  // Create config file with default values
  createFile() {
    return outputJsonSync(this.fileBase, this.defaults);
  }

  load() {
    try {
      this.object = readJsonSync(this.fileBase);
    } catch (e) {
      // Defaults
      this.object = this.defaults;
    }
  }

  // _getConnectString = (env = "DEV") => this.object[env].connectString;
  // _getUserObjects = (env = "DEV") => this.object[env].users;

  // Get "users" object array from json
  // filter out disabled
  _getAllUsersByEnv = env => data => {
    return _.pipe(
      _.get(env),
      _.get("users"),
      _.filter(v => !v.disabled)
    )(data);
  };

  /**
   * Get all schemas for environment.
   * *If User has no objects, Schemas are used
   *
   *  @param {string} env
   *  @returns {string[]} user
   */
  getSchemas = (env = "DEV") => {
    return _.pipe(
      this._getAllUsersByEnv(env),
      _.flatMap(v => (v.schemas ? v.schemas : [v.user])),
      _.map(_.toUpper),
      _.uniq
    )(this.object);
  };

  /**
   * Connection config object from dbConfig.json
   * @typedef {{env: string, user: string, password: string, connectString: string, default: ?boolean, schemas: ?string[], disabled: ?boolean}} ConnectionConfig
   */

  /**
   ** Get connection configuration. Extracted from DB config file.
   * Filter by env and user
   * User parameter is optional, return default configuration if cannot be determined (user non existent)
   * @param {string} env
   * @param {?string} user
   * @returns {ConnectionConfig} Connection config
   */
  getConfiguration = (env, user) => {
    if (!env) throw Error(`No env.`);

    // Head of flattened object that we return
    const head = { env, connectString: this.object[env].connectString };

    // First filter by env param, if only one config return
    let byEnv = this._getAllUsersByEnv(env)(this.object);

    if (!byEnv)
      throw Error(
        `dbconfig.json: Invalid structure. Cannot find "${env}" env.`
      );

    if (byEnv.length === 0) {
      throw Error(`dbconfig.json: No user for "${env}" env.`);
    }
    if (byEnv.length === 1) {
      return { ...head, ...byEnv[0] };
    }

    // If user param exists, filter by v.user or v.schema
    let byUser = user
      ? _.filter(
          v =>
            v.user.toUpperCase() === user.toUpperCase() ||
            // IncludesCaseInsensitive([v.user], user) ||
            (v.schemas && IncludesCaseInsensitive(v.schemas, user))
        )(byEnv)
      : byEnv;

    if (byUser.length === 1) {
      return { ...head, ...byUser[0] };
    }
    // non existing user -> go for default
    // if (byUser.length === 0) {
    //   byUser = byEnv;
    // }

    // We couldn't match by user so go for default for env
    let byDefault = _.filter({ default: true })(byEnv);

    if (byDefault.length === 1) {
      return { ...head, ...byDefault[0] };
    } else {
      throw Error(
        `dbconfig.json: No default connection configuration for "${env}" env.`
      );
    }
  };
}
export const config = new DBConfig(process.env.dbConfigPath);

// Each env has its own pool with users
let _pool = {};
_pool.DEV = {};
_pool.TEST = {};
_pool.UAT = {};

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

const closeConnection = async conn => {
  if (conn) {
    try {
      await conn.close();
    } catch (e) {
      console.log(e);
    }
  }
};

/**
 ** Return connection string.
 * @param {ConnectionConfig} connCfg
 */
const getConnectionString = connCfg => {
  return `${connCfg.user}/${connCfg.password}@${connCfg.connectString}`;
};

const compile = async (connection, code, warningScope = "NONE") => {
  oracledb.outFormat = oracledb.ARRAY;
  oracledb.autoCommit = true;
  if (warningScope.toUpperCase() !== "NONE") {
    await connection.execute(
      `call dbms_warning.set_warning_setting_string ('ENABLE:${warningScope}', 'SESSION')`
    );
  }
  await connection.execute(`call dbms_output.enable(null)`);
  return connection.execute(code);
};

const getObjectDdl = (
  connection,
  getFunctionName,
  { owner, objectName, objectType1 }
) => {
  oracledb.outFormat = oracledb.ARRAY;
  return connection
    .execute(
      `select ${getFunctionName}(upper(:objectType1), upper(:objectName), upper(:owner)) from dual`,
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
    where upper(owner) = upper(:owner)
    and upper(type) = upper(nvl(:objectType, type))
    and upper(name) = upper(nvl(:objectName, name))
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
      `select owner, object_id, object_name, object_type, cast(last_ddl_time as timestamp) as last_ddl_time, status
    from all_objects
    where upper(owner) = upper(:owner)
    and upper(object_type) = upper(nvl(:objectType, object_type))
    and upper(object_name) = upper(nvl(:objectName, object_name))
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

const getGeneratorFunction = (
  connection,
  getFunctionName,
  { owner, objectName, objectType1 },
  selectedObject
) => {
  oracledb.outFormat = oracledb.ARRAY;
  return connection
    .execute(
      `select ${getFunctionName}(upper(:objectType1), upper(:objectName), upper(:owner), upper(:selectedObject)) from dual`,
      {
        owner,
        objectName,
        objectType1,
        selectedObject
      }
    )
    .then(result => result.rows[0][0]);
};

const getLastDdlTime = async (conn, obj) => {
  let all = await getObjectsInfo(conn, obj);
  return all.length !== 0 ? all[0].LAST_DDL_TIME : null;
};

const isDifferentDdlTime = async (conn, obj) => {
  let timeOracle = await getLastDdlTime(conn, obj);
  let timeLocal = await dbLoc.getDdlTime(obj);
  return (
    timeOracle &&
    timeLocal &&
    timeLocal.toLocaleString() !== timeOracle.toLocaleString()
  );
};

const syncDdlTime = async (conn, obj) => {
  let timeOracle = await getLastDdlTime(conn, obj);
  return await dbLoc.upsertDdlTime(obj, timeOracle);
};

const createError = ({ LINE, POSITION, ATTRIBUTE, TEXT, _ID }) => ({
  isError: () => ATTRIBUTE === "ERROR",
  isWarning: () => ATTRIBUTE === "WARNING",
  isInfo: () => ATTRIBUTE === "INFO",
  isDirty: () => _ID === "0001",
  toString: () => `${LINE}/${POSITION} ${ATTRIBUTE} ${TEXT}`
});

const createErrorList = (arr = []) => {
  let _arr = [];
  // Construct errors from input array
  arr.forEach(err => _arr.push(createError(err)));
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

const getErrorSystem = (msg, lineOffset = 1, line = 1, position = 1) => {
  // Matches only one line of error msg
  let reg = /.*:\sline\s(\d*),\scolumn\s(\d*):\n(.*)/g;
  let s;
  let err = createErrorList();
  while ((s = reg.exec(msg)) !== null) {
    err.add(
      createError({
        LINE: lineOffset + parseInt(s[1]) - 1,
        POSITION: s[2],
        TEXT: s[3],
        ATTRIBUTE: "ERROR",
        _ID: "0003"
      })
    );
  }
  if (err.get().length === 0) {
    err.add(
      createError({
        LINE: lineOffset + line - 1,
        POSITION: position,
        TEXT: msg,
        ATTRIBUTE: "ERROR",
        _ID: "0002"
      })
    );
  }

  return err;
};

const getErrorObjectChanged = () => {
  return createErrorList([
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
  return createErrorList(errsArray);
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

const getDbmsOutputLine = connection => {
  return connection
    .execute("begin dbms_output.get_line(:line, :status); end;", {
      line: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32767 },
      status: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
    })
    .then(result => result.outBinds);
};

const getDbmsOutput = async connection => {
  let line,
    status = 0,
    lines = [];

  while (status === 0) {
    ({ line, status } = await getDbmsOutputLine(connection));
    line && lines.push(line);
  }

  return lines;
};

module.exports.getConnection = getConnection;
module.exports.getObjectDdl = getObjectDdl;
module.exports.getErrorsInfo = getErrorsInfo;
module.exports.getObjectsInfo = getObjectsInfo;
module.exports.getLastDdlTime = getLastDdlTime;
module.exports.syncDdlTime = syncDdlTime;
module.exports.getConnectionString = getConnectionString;
module.exports.closeConnection = closeConnection;
module.exports.isDifferentDdlTime = isDifferentDdlTime;
module.exports.compile = compile;
module.exports.createError = createError;
module.exports.createErrorList = createErrorList;
module.exports.getErrorObjectChanged = getErrorObjectChanged;
module.exports.getErrors = getErrors;
module.exports.getErrorSystem = getErrorSystem;
module.exports.getNameResolve = getNameResolve;
module.exports.getDbmsOutput = getDbmsOutput;
module.exports.getGeneratorFunction = getGeneratorFunction;
