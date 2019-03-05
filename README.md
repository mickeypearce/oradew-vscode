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
dbconfig.json           DB connection configuration (required)
oradewrc.json           Workspace configuration
```

## Commands

### Basic Workflow

**Setup**

- `Initialize Workspace/Version` - Init config files (dbconfig.json, oradewrc.json), Create workspace structure (./scripts, ./src, ./test dirs) and Init git repo when starting from scratch (new workspace). Clear logs, package and scripts: prepare workspace for a new version/feature when executed in a non-empty workspace.
- `Import All Source from DB` - Create Source files from DB objects

**Build**

- `Compile Changes to DB` (F6) - Compile changed Source objects (working tree). Succesfully compiled files are added to Staging area.
- `Compile Current File` - Compile Source object (or any file with a single SQL or PL/SQL statement)
- `Run Current File as Script` (F5) - Execute a SQL script (with SQLPlus)
- `Run Selected Statement` (Ctrl+Enter) - Execute a SQL query or PL/SQL statement with autoCommit and dbms_output enabled

**Install**

- `Package` (F9) - Generate SQL deployment script, TODO and BOL file.
- `Deploy` - Run SQL deployment script on selected environment (with SQLPlus). Command always prompts with environment pick.

### Additional

- `Import Changes from DB` (Shift+F6)
- `Import Current File / Import Selected Object`
- `Compile All Source to DB`
- `Run tests`
- `Populate Package Input` (Shift+F9) with changed files from Git history using latest tagged commit as a starting point.
- `Generate...` PL/SQL code with a code generator.

### Environments

- `Set DB Environment` - Pick DB environment that is then used for executing commands. When option `<None>` is selected, you choose DB environment every time you execute command. Environment list is generated from `dbconfig.json` file. There are three envs by default (DEV, TEST, UAT), which can be extended with additional environments. The default value is `DEV`.

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
  "import.getDdlFunction": "dbms_metadata.get_ddl"
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

Write a PL/SQL function on database, add a definition to configuration file (`oradewrc-generate.json`) and then use `Generate...` command to execute your generator. A new file with the generated content will be created in your workspace.

#### Function specificaton

The generator function on DB has to have the following specification (parameters):

```sql
FUNCTION updateStatement(
  object_type IN VARCHAR2,    -- derived from path of currently open ${file}
  name IN VARCHAR2,           -- derived from path of currently open ${file}
  schema IN VARCHAR2,         -- derived from path of currently open ${file}
  selected_object IN VARCHAR2 -- ${selectedText} in editor
) RETURN CLOB;
```

Function parameters are derived from currently opened file and selected text in your editor when the generator is executed. The first three parameters (`object_type`, `name`, `schema`) are deconstructed from the path of the currently opened \${file} as `./src/${schema}/${object_type}/${name}.sql`, whereas `selected_object` is the currently \${selectedText} in editor.

#### Generator definition

Create a configuration file `oradewrc-generate.json` in your workspace root with a definiton:

```json
  "generator.define": [
    {
      "label": "Update Statement",
      "function": "utl_generate.updateStatement",
      "description": "Generate update statement for a table"
    }
  ]
```

The `label` and `function` properties are required for a generator to be succesfully defined (`description` is optional). Use `output` property to specify a file path of the generated content (also optional). If the `output` is omitted a file with unique filename will be created in ./scripts directory.

<b>NOTE</b>: Generators have a separate repository over here: [Oradew Code Generators](https://github.com/mickeypearce/oradew-generators). Your contributions are welcomed!

## Installation

### Prerequisites

- Node.js 6, 8, 10 or 11
- Git
- SQLPlus

### Important

> `Extension uses Oracle driver (node-oracledb v3.1.1) that includes pre-built binaries for Node 6, 8, 10 and 11 on: Windows 64-bit (x64), macOS 64-bit (Intel x64) and Linux 64-bit (x86-64) (built on Oracle Linux 6).`

For other environments, please refer to [INSTALL](https://github.com/oracle/node-oracledb/blob/master/INSTALL.md) (Oracle) on building from source code.

### Included extensions:

- Language PL/SQL
- oracle-format

### Recommended extensions:

- GitLens
- Numbered bookmarks
- Better comments
- Multiple clipboards

## Command Line <sup>Preview</sup>

You can now execute Oradew commands (gulp tasks) also from the command line (CLI).

### Installation

```bash
# From the extension folder %USERPROFILE%/.vscode/extensions/mp.oradew-vscode-...
> npm run install-cli
```

This will install `oradew` command globally.

If you are installing from the repository you must first compile the source code:

```bash
> git clone https://github.com/mickeypearce/oradew-vscode
> npm install && npm run compile && npm run install-cli
```

### Usage

```bash
# (Use `oradew <command> --help` for command options.)
> oradew --help
Usage: oradew <command> [options]

Commands:
  initWorkspace [options]   Initialize a new workspace
  createSource [options]    Import All Objects from Db to Source
  compileFiles [options]    Compile files
  compileObject [options]   Compile object (statement)
  importFiles [options]     Import source files from DB
  importObject [options]    Import object from DB
  package [options]         Package files to deploy script
  deploy|runFile [options]  Run script (with SQLPlus)
  runTest [options]         Run unit tests
  generate [options]        Code generator
```

### Example

```bash
# Create simple dbconfig file and run commmand on DEV environment
> echo {"DEV": {"connectString": "localhost/orclpdb", "users": [{"user": "hr", "password": "welcome"}]}} > dbconfig.json
> oradew compileObject --object "select 'world' as hello from dual"
```
