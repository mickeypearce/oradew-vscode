# Oradew

[![Build Status](https://dev.azure.com/mickeypearce0384/Oradew/_apis/build/status/mickeypearce.oradew-vscode)](https://dev.azure.com/mickeypearce0384/Oradew/_build/latest?definitionId=1)

> Oracle (PL/SQL) Development Workspace for VS Code.

This extension allows you to develop your Oracle (PL/SQL) project in Visual Studio Code. It enables you to:

- Manage PL/SQL source code with version control (Git)
- Compile files and Run statements with ORA errors problem matching
- Package files into a single SQL deployment script
- Deploy to multiple environments in one click

![Compile Demo](images/demo.gif)

## Structure

```
./deploy                Deployment package
./scripts               SQL Scripts (DDL, DML, etc)
./src                   Source with PL/SQL objects (FUNCTIONS, PACKAGES, PROCEDURES, TABLES, TRIGGERS, TYPES, VIEWS)
./test                  Unit tests
dbconfig.json           DB connection configuration
oradewrc.json           Workspace configuration
```

## Commands

### Basic Workflow

**Setup**

- `Initialize Workspace/Version` - Create/clean workspace structure and configuration files
- `Import All Source from DB` - Create Source files from DB objects from DEV environment

**Build**

- `Compile Changes to DB` (_F6_) - Compile changed Source objects (working tree) to DEV. Succesfully compiled files are added to Staging area.
- `Compile Current File` - Compile Source object (or any file with a single SQL or PL/SQL statement)
- `Run Current File as Script` (_F5_) - Execute a SQL script (with SQLPlus)
- `Run Selected Statement` (_Ctrl+Enter_) - Execute a SQL query or PL/SQL statement with autoCommit and dbms_output enabled

**Install**

- `Package` (_F9_) - Generate SQL deployment script, TODOs file and ChangeLog
- `Deploy to TEST / UAT` - Run SQL deployment script on TEST or UAT environment (with SQLPlus)

### Additional

- `Import Changes from DB` (_Shift+F6_)
- `Import Current File / Import Selected Object`
- `Compile All Source to DB`
- `Run tests`
- `Populate Package Input` (_Shift+F9_) with changed files from Git history using latest tagged commit as a starting point.
- `Generate` PL/SQL code with a code generator.

_All commands execute to `DEV` environment by default (except for Install commands). Environment specific commands start with prefix: `TEST:` or `UAT:`._

## Configuration

Workspace supports a base configuration file (`oradewrc.json`) and an additional configuration file for each environment (`oradewrc.test.json`, `oradewrc.uat.json`). The base configuration contains settings that are usually common across all environments but can be extended (overloaded) optionally by environment specific configurations for environment-specific commands.

Configuraton files are not required. Default values will be assumed in case they are not present. The following settings are available (`oradewrc*.json`):

```json
{
  "package.input": [
    "./scripts/**/initial*.sql",
    "./src/**/VIEWS/*.sql",
    "./src/**/TYPES/*.sql",
    "./src/**/TYPE_BODIES/*.sql",
    "./src/**/TRIGGERS/*.sql",
    "./src/**/PACKAGES/*.sql",
    "./src/**/PACKAGE_BODIES/*.sql",
    "./src/**/FUNCTIONS/*.sql",
    "./src/**/PROCEDURES/*.sql",
    "./scripts/**/final*.sql",
    "!./**/*EXCLUDE*.sql"
  ],
  "package.output": "./deploy/Run.sql",
  "package.encoding": "utf8",
  "package.templating": false,
  "source": ["./src/**/*.sql"],
  "compile.warnings": "NONE",
  "compile.force": false,
  "version.number": "0.0.1",
  "version.description": "New feature",
  "version.releaseDate": "2099-01-01",
  "test.input": ["./test/**/*.test.sql"],
  "import.getDdlFunction": "dbms_metadata.get_ddl",
  "generator.define": []
}
```

- `package.input` - Array of globs for packaging files into deploy script file (output). Preserving order, prefix with ! for excluding. Use `Populate Package Input` to extract only changed file paths from Git history starting from latest tagged commit (latest version). This way you can package and deploy only current version changes.
- `package.output` - Deploy script file path. Created with `Package` command from concatenated input files and prepared for SQLPlus execution. (wrapped with "SPOOL deploy.log", "COMMIT;", etc )
- `package.encoding` - Encoding of deploy script file. (ex.: utf8, win1250, ...) The default value is `utf8`.
- `package.templating` - Turn on templating of config variables. Use existing ('\${config[\"version.releaseDate\"]}') or declare a new variable in config file and than use it in your sql file. Variables are replaced with actual values during packaging (`Package` command). The default value is `false`.
- `source` - Glob pattern for source files.
- `compile.warnings` - PL/SQL compilation warning scopes. The default value is `NONE`.
- `compile.force` - Conflict detection (on DEV environment). If object you are compiling has changed on DB (has a different DDL timestamp), you are prevented from overriding the changes with a merge step. Resolve merge conflicts if necessary and than compile again. Set to `true` to compile without conflict detection. The default value is `false`.
- `version.number` - Version number.
- `version.description` - Version description.
- `version.releaseDate` - Version release date.
- `test.input` - Array of globs for test files.
- `import.getDdlFunction` - Custom Get_DDL function name. Use your own DB function to customize import of object's DDL. It is used by `Import` commands. The default value is `DBMS_METADATA.GET_DDL`.
  ```sql
  -- Example of a DB function specification:
  FUNCTION CustomGetDDL(object_type IN VARCHAR2, name IN VARCHAR2, schema IN VARCHAR2 DEFAULT NULL) RETURN CLOB;
  ```

### Code Generator

Configure the setting `generator.define` to define code generators. Then use `Generate` command to generate your PL/SQL code.

The `label` and `function` properties are required for a generator to be succesfully defined but a `description` is optional. You can also use `output` property to define a file path of the generated content (also optional). If the `output` is omitted a file with unique filename is created in `./scripts` directory. A generator definition example follows:

```json
  "generator.define": [
    {
      "label": "Update Statement",
      "function": "utl_generate.updateStatement",
      "description": "Generate update statement for a table"
    }
  ]
```

You can find generator's source code (including `updateStatement` from previous example) and additional information about writing generators over here: [Oradew Code Generators](https://github.com/mickeypearce/oradew-generators).

## Installation

### Prerequisites

- Node.js
- Git
- SQLPlus

### Important

> `Oracle driver (node-oracledb) in extension is precompiled with "node-v59 (Node.js 9) - win32 - x64 (64bit)" binary package.`

Oracle client library architecture (instantclient), Node.js version, OS and architecture must match precompiled configuration otherwise node-oracledb drivers have to be rebuild.

```bash
## Rebuild Oracle drivers (in ext folder ~/.vscode/extensions/mp.oradew-vscode-...):
> npm rebuild
```

### Included extensions:

- Language PL/SQL
- oracle-format

### Recommended extensions:

- GitLens
- Numbered bookmarks
- Better comments
- Multiple clipboards
