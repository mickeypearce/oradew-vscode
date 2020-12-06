import child = require("child_process");
import { resolve } from "path";

export class OradewProcess {
  wsConfigPath: string;
  gulpPathJs: string;
  gulpFile: string;
  gulpParams: Array<string>;
  processEnv: object;
  cliPath: string;

  constructor(tmConfig: {
    workspaceDir: string; // Workspace folder
    cliDir: string; // CLI folder
    storageDir: string; // Storage folder
    dbConfigPath?: string; // ./dbconfig.json by default
    wsConfigPath?: string; // ./oradewrc.json by default
    isSilent?: boolean; //gulp option: --silent
    isColor?: boolean; //gulp option:--color
    cliExecutable: string; //DB CLI executable (ex. sqlplus)
    cliCommand: string; //DB CLI command literal
    envVariables?: { [id: string]: string }; // ENV vars (ex: "NLS_LANG": "AMERICAN_AMERICA.cp1252" )
  }) {
    const {
      workspaceDir,
      cliDir,
      storageDir,
      wsConfigPath,
      dbConfigPath,
      isSilent,
      isColor,
      cliExecutable,
      cliCommand,
      envVariables,
    } = tmConfig;

    this.gulpPathJs = resolve(cliDir, "node_modules/gulp/bin/gulp.js");
    this.gulpFile = resolve(cliDir, "dist/gulpfile.js");

    this.cliPath = resolve(cliDir, "dist/oradew.js");

    this.gulpParams = [
      `${this.gulpPathJs}`,
      "--cwd",
      `${workspaceDir}`,
      "--gulpfile",
      `${this.gulpFile}`,
      // Set only when true, had some problems with false
      ...(isColor ? ["--color", "true"] : []),
      ...(isSilent ? ["--silent", "true"] : []),
    ];

    this.processEnv = {
      env: {
        NODE_OPTIONS: "--no-deprecation",
        ORADEW_STORAGE_DIR: storageDir,
        ORADEW_DB_CONFIG_PATH: dbConfigPath,
        ORADEW_WS_CONFIG_PATH: wsConfigPath,
        ORADEW_CLI_EXECUTABLE: cliExecutable,
        ORADEW_CLI_COMMAND: cliCommand,
        ORADEW_SILENT: isSilent,
        ...(envVariables || {}),
      },
      // inherit stdio
      stdio: "inherit",
    };
  }

  execute = (argv) => {
    const params = [...this.gulpParams, ...argv.slice(2)];
    // console.log("Executing oradew task: " + params.join(" "));

    // Execute process
    return child.spawn(process.execPath, params, this.processEnv);
    // ls.stdout.on("data", (data) => {
    //   console.log(`stdout: ${data}`);
    // });
    // ls.on("error", (data) => {
    //   console.log(`error: ${data}`);
    // });
  };
}
