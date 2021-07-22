const oracledb = require("oracledb");

import * as inquirer from "inquirer";
import { getDdlTime, upsertDdlTime } from "./nedb";
import { IConnectionConfig } from "./config";

oracledb.fetchAsString = [oracledb.DATE, oracledb.CLOB, oracledb.NUMBER];

interface IObjectParameter {
  owner: string;
  objectType?: string;
  objectType1?: string;
  objectName?: string;
}

// Each env has its own pool with users
let _pool = {};

async function getPassword(connCfg: IConnectionConfig) {
  if ((!connCfg.password && !connCfg.walletConnectString) || connCfg.askForPassword) {
    const res = await inquirer.prompt([
      {
        type: "password",
        name: "password",
        message: `${connCfg.user.toUpperCase()} password?`,
        mask: "*",
      },
    ]);
    return res.password ?? "";
  } else {
    return connCfg.password ?? "";
  }
}

/**
 ** Return existing connection from pool or creates a new one.
 * @param {IConnectionConfig} connCfg
 */
const getConnection = async (connCfg: IConnectionConfig) => {
  let { env, user, connectString, walletConnectString } = connCfg;
  if (!_pool[env]) {
    _pool[env] = {};
  }
  if (_pool[env][user]) {
    return _pool[env][user].getConnection();
  }
  const password = await getPassword(connCfg);
  if (walletConnectString) {
    return oracledb
      .createPool({
        externalAuth: true,
        connectionString: walletConnectString
      })
      .then((newPool) => {
        _pool[env][user] = newPool;
        return _pool[env][user].getConnection();
      });
  } else {
    return oracledb
      .createPool({
        user,
        password,
        connectString
      })
      .then((newPool) => {
        _pool[env][user] = newPool;
        return _pool[env][user].getConnection();
      });
  }
};

const closeConnection = async (conn) => {
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
 * @param {IConnectionConfig} connCfg
 */
const getConnectionString = async (connCfg: IConnectionConfig) => {
  const password = await getPassword(connCfg);
  if (!connCfg.walletConnectString) {
    return `${connCfg.user}/${password}@${connCfg.connectString}`;
  } else {
    return `/${password}@${connCfg.walletConnectString}`;
  }
};

const compile = async (connection, code, warningScope = "NONE") => {
  oracledb.outFormat = oracledb.OUT_FORMAT_ARRAY;
  oracledb.autoCommit = true;
  if (warningScope.toUpperCase() !== "NONE") {
    await connection.execute(
      `call dbms_warning.set_warning_setting_string ('ENABLE:${warningScope}', 'SESSION')`
    );
  }
  await connection.execute(`call dbms_output.enable(null)`);
  return connection.execute(code);
};

const getObjectDdl = (connection, getFunctionName, { owner, objectName, objectType1 }) => {
  oracledb.outFormat = oracledb.OUT_FORMAT_ARRAY;
  if (objectType1 === "APEX") {
    return connection
      .execute(
        `
        declare
          l_files apex_t_export_files;
          l_file_content clob := empty_clob;
          l_app_id number;
        begin
            select application_id
            into l_app_id
            from apex_applications
            where upper(application_id || '-' || alias) = upper(:objectName);

            l_files := apex_export.get_application(
                p_application_id          => l_app_id,
                p_split                   => false,
                p_with_date               => true,
                p_with_ir_public_reports  => true,
                p_with_ir_private_reports => true,
                p_with_ir_notifications   => true,
                p_with_translations       => true,
                p_with_pkg_app_mapping    => true,
                p_with_original_ids       => true,
                p_with_no_subscriptions   => true,
                p_with_comments           => true,
                p_with_supporting_objects => 'Y',
                p_with_acl_assignments    => true);

            dbms_lob.createtemporary(
              lob_loc => l_file_content
              , cache => false
              , dur => dbms_lob.call
            );

            l_file_content := l_files(1).contents;
            :apexsql := l_file_content;
        end;
        `,
        {
          objectName,
          apexsql: {
            dir: oracledb.BIND_OUT,
            type: oracledb.STRING,
            maxSize: 524288000,
          },
        }
      )
      .then((result) => result.outBinds.apexsql);
  } else {
    return connection
      .execute(
        `select ${getFunctionName}(upper(:objectType1), upper(:objectName), upper(:owner)) from dual`,
        {
          owner,
          objectName,
          objectType1,
        }
      )
      .then((result) => result.rows[0][0]);
  }
};

const getErrorsInfo = (connection, { owner, objectName, objectType }) => {
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
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
        objectType,
      }
    )
    .then((result) => result.rows);
};

const getObjectsInfo = (connection, { owner, objectType, objectName }: IObjectParameter) => {
  // Exclude types that are silently created when defined in packages (SYS_PLSQL)
  // Only allow APEX exporting if APEX is installed and version >= 5.1.4
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

  let allObjectsQuery = `
    SELECT
      owner,
      object_id,
      object_name,
      object_type,
      CAST(last_ddl_time AS TIMESTAMP) AS last_ddl_time,
      status
    FROM
      all_objects
    WHERE
      upper(owner) = upper(:owner)
      AND upper(object_type) = upper(nvl(:objecttype, object_type))
      AND upper(object_name) = upper(nvl(:objectname, object_name))
      AND object_name NOT LIKE 'SYS_PLSQL%'
    `;

  let allObjectsApexQuery =
    allObjectsQuery +
    `
    union all

    select owner
        , to_number(workspace_id || application_id) object_id
        , application_id || '-' || alias object_name
        , 'APEX' object_type
        , cast(last_updated_on as timestamp) as last_ddl_time
        , 'VALID' status
    from apex_applications
    where upper(owner) = upper(:owner)
    AND 'APEX' = upper(nvl(:objecttype, 'APEX'))
    AND upper(application_id || '-' || alias) = upper(nvl(:objectname, application_id || '-' || alias))
    order by object_type, object_id
    `;

  let hasApexQuery = `
  begin
    execute immediate 'SELECT count(*) FROM apex_release where replace(version_no, ''.'', '''') > 5140000'
    into :hasApex;
  exception
    when others then
      :hasApex := 0;
  end;
  `;

  return connection
    .execute(hasApexQuery, {
      hasApex: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    })
    .then((result) => {
      let finalObjectsQuery = allObjectsQuery;
      if (result.outBinds.hasApex > 0) {
        finalObjectsQuery = allObjectsApexQuery;
      }
      return connection
        .execute(finalObjectsQuery, {
          owner,
          objectName,
          objectType,
        })
        .then((result) => result.rows);
    });
};

const getGeneratorFunction = (
  connection,
  getFunctionName,
  { owner, objectName, objectType1 }: IObjectParameter,
  selectedObject
) => {
  oracledb.outFormat = oracledb.OUT_FORMAT_ARRAY;
  return connection
    .execute(
      `select ${getFunctionName}(upper(:objectType1), upper(:objectName), upper(:owner), upper(:selectedObject)) from dual`,
      {
        owner,
        objectName,
        objectType1,
        selectedObject,
      }
    )
    .then((result) => result.rows[0][0]);
};

const getLastDdlTime = async (conn, obj) => {
  let all = await getObjectsInfo(conn, obj);
  return all.length !== 0 ? all[0].LAST_DDL_TIME : null;
};

const isDifferentDdlTime = async (conn, obj, env) => {
  let timeOracle = await getLastDdlTime(conn, obj);
  let timeLocal = await getDdlTime(obj, env);
  return timeOracle && timeLocal && timeLocal.toLocaleString() !== timeOracle.toLocaleString();
};

const syncDdlTime = async (conn, obj, env) => {
  let timeOracle = await getLastDdlTime(conn, obj);
  return await upsertDdlTime(obj, timeOracle, env);
};

const createError = ({ LINE, POSITION, ATTRIBUTE, TEXT, _ID }) => ({
  isError: () => ATTRIBUTE === "ERROR",
  isWarning: () => ATTRIBUTE === "WARNING",
  isInfo: () => ATTRIBUTE === "INFO",
  isDirty: () => _ID === "0001",
  toString: () => `${LINE}/${POSITION} ${ATTRIBUTE} ${TEXT}`,
});

const createErrorList = (arr = []) => {
  let _arr = [];
  // Construct errors from input array
  arr.forEach((err) => _arr.push(createError(err)));
  let obj = {
    add: (err) => {
      _arr.push(err);
      return obj;
    },
    get: () => _arr,
    hasErrors: () => _arr.some((err) => err.isError()),
    hasWarnings: () => _arr.some((err) => err.isWarning()),
    hasInfos: () => _arr.some((err) => err.isInfo()),
    hasDirt: () => _arr.some((err) => err.isDirty()),
    toString: () => _arr.map((err) => err.toString()).join("\n"),
  };
  return obj;
};

const parseForErrors = (msg) => {
  // Matches only one line of error msg
  const regCommon = /.*Error starting at line : (\d+)[\s\S]*?Error report -\n(.*line (\d+), column (\d+):\n(.*)|[\s\S]*?at line (\d+)|.*)/g;
  const regCommands = /.*Error starting at line : (\d+)[\s\S]*?Line : (\d+) Column : (\d+)[\s\S]*?Error report -\n(.*)/g;
  const regTableError = /(\d+)\/(\d+)\s*(.*)/g;
  // Sqlplus error msg
  const regCommonSqlplus = /.*ERROR at line (\d+):.*\n(.*line (\d+), column (\d+):\n(.*)|[\s\S]*?: at line (\d+)|.*)/g;

  let s;
  let err = createErrorList();

  while ((s = regCommon.exec(msg)) !== null) {
    if (s[1] && s[3] && s[4] && s[5]) {
      // line and column exists after error report: ex:
      // Error report -
      // ORA-06550: line 3, column 1:
      // PLS-00103: Encountered the symbol "END" when expecting one of the following:
      err.add(
        createError({
          LINE: parseInt(s[1]) + parseInt(s[3]) - 1,
          POSITION: s[4],
          TEXT: s[5],
          ATTRIBUTE: "ERROR",
          _ID: "0003",
        })
      );
    } else if (s[1] && s[2] && s[6]) {
      // only line...
      // Error report -
      // ORA-00001: unique constraint (HR.my_table PK) violated
      // ORA-06512: at line 34
      err.add(
        createError({
          LINE: parseInt(s[1]) + parseInt(s[6]) - 1,
          POSITION: 1,
          TEXT: s[2],
          ATTRIBUTE: "ERROR",
          _ID: "0003",
        })
      );
    } else {
      // ex: otherwise
      // Error report -
      // ORA-01430: column being added already exists in table
      err.add(
        createError({
          LINE: parseInt(s[1]),
          POSITION: 1,
          TEXT: s[2],
          ATTRIBUTE: "ERROR",
          _ID: "0003",
        })
      );
    }
  }

  // Offset already calculated in error message
  while ((s = regCommands.exec(msg)) !== null) {
    err.add(
      createError({
        LINE: parseInt(s[2]),
        POSITION: s[3],
        TEXT: s[4],
        ATTRIBUTE: "ERROR",
        _ID: "0003",
      })
    );
  }
  // !!! this Line information has not an offset so it is wrong in multi stm script
  // ex.:
  // LINE/COL  ERROR
  // --------- -------------------------------------------------------------
  // 3/1       PLS-00103: Encountered the symbol "NULL" when expecting one of the following: ...
  while ((s = regTableError.exec(msg)) !== null) {
    err.add(
      createError({
        LINE: parseInt(s[1]),
        POSITION: s[2],
        TEXT: s[3],
        ATTRIBUTE: "ERROR",
        _ID: "0003",
      })
    );
  }
  // offset is not properly calculated for mulitple stm
  // ERROR at line 1:
  // ORA-00001: unique constraint (HR.my_table PK) violated
  // ORA-06512: at line 20
  // ---or---
  // ERROR at line 1:
  // ORA-01031: insufficient privileges
  while ((s = regCommonSqlplus.exec(msg)) !== null) {
    if (s[1] && s[3] && s[4] && s[5]) {
      // ERROR at line 3:
      // ORA-06550: line 3, column 1:
      // PLS-00103: Encountered the symbol "END" when expecting one of the following:
      // := . ( @ % ;
      // The symbol ";" was substituted for "END" to continue.
      err.add(
        createError({
          LINE: parseInt(s[3]),
          POSITION: s[4],
          TEXT: s[5],
          ATTRIBUTE: "ERROR",
          _ID: "0003",
        })
      );
    } else if (s[1] && s[2] && s[6]) {
      // only line...
      // ERROR at line 1:
      // ORA-00001: unique constraint (HR.my_table PK) violated
      // ORA-06512: at line 20
      err.add(
        createError({
          LINE: parseInt(s[6]),
          POSITION: 1,
          TEXT: s[2],
          ATTRIBUTE: "ERROR",
          _ID: "0003",
        })
      );
    } else {
      // ex: otherwise
      // ERROR at line 1:
      // ORA-01031: insufficient privileges
      err.add(
        createError({
          LINE: parseInt(s[1]),
          POSITION: 1,
          TEXT: s[2],
          ATTRIBUTE: "ERROR",
          _ID: "0003",
        })
      );
    }
  }
  return err;
};

const getErrorSystem = (msg, lineOffset = 1, line = 1, position = 1) => {
  let err = parseForErrors(msg);
  if (err.get().length === 0) {
    err.add(
      createError({
        LINE: lineOffset + line - 1,
        POSITION: position,
        TEXT: msg,
        ATTRIBUTE: "ERROR",
        _ID: "0002",
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
      TEXT: "Db Object has changed. Resolve any merge failure and compile again.",
      ATTRIBUTE: "ERROR",
      _ID: "0001",
    },
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
          maxSize: 30,
        },
        object_number: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      }
    )
    .then((result) => result.outBinds);
};

const getDbmsOutputLine = (connection) => {
  return connection
    .execute("begin dbms_output.get_line(:line, :status); end;", {
      line: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32767 },
      status: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    })
    .then((result) => result.outBinds);
};

const getDbmsOutput = async (connection) => {
  let line,
    status = 0,
    lines = [];

  while (status === 0) {
    ({ line, status } = await getDbmsOutputLine(connection));
    if (line) {
      lines.push(line);
    }
  }

  return lines;
};

export {
  getConnection,
  getObjectDdl,
  getErrorsInfo,
  getObjectsInfo,
  getLastDdlTime,
  syncDdlTime,
  getConnectionString,
  closeConnection,
  isDifferentDdlTime,
  compile,
  createError,
  createErrorList,
  getErrorObjectChanged,
  getErrors,
  getErrorSystem,
  getNameResolve,
  getDbmsOutput,
  getGeneratorFunction,
  parseForErrors,
};
