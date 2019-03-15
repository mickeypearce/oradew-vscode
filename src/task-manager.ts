import child = require("child_process");
import path = require("path");

export class TaskManager {
  wsConfigPath: string;
  gulpPathJs: string;
  gulpFile: string;
  gulpParams: Array<string>;
  processEnv: object;

  constructor(tmConfig: {
    workspacePath: string; // Workspace folder
    contextPath: string; // Extension folder
    storagePath: string; // Storage folder
    dbConfigPath?: string; // ./dbconfig.json by default
    wsConfigPath?: string; // ./oradewrc.json by default
    isSilent?: boolean; //gulp option: --silent
    isColor?: boolean; //gulp option:--color
  }) {
    const {
      workspacePath,
      contextPath,
      storagePath,
      wsConfigPath,
      dbConfigPath,
      isSilent,
      isColor
    } = tmConfig;

    this.gulpPathJs = path.resolve(
      contextPath,
      "node_modules/gulp/bin/gulp.js"
    );
    this.gulpFile = path.resolve(contextPath, "out/gulpfile.js");

    this.gulpParams = [
      `${this.gulpPathJs}`,
      "--cwd",
      `${workspacePath}`,
      "--gulpfile",
      `${this.gulpFile}`,
      // Set only when true, had some problems with false
      ...(isColor ? ["--color", "true"] : []),
      ...(isSilent ? ["--silent", "true"] : [])
    ];

    this.processEnv = {
      env: {
        storagePath,
        dbConfigPath,
        wsConfigPath
      },
      // inherit stdio
      stdio: "inherit"
    };
  }

  executeOradewTask = argv => {
    const params = [...this.gulpParams, ...argv.slice(2)];
    console.log("Executing oradew task: " + params.join(" "));

    // Execute process
    child.spawn(process.execPath, params, this.processEnv);
  }
}
