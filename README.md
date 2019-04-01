# Oracle (PL/SQL) Development Workspace

[![Build Status](https://dev.azure.com/mickeypearce0384/Oradew/_apis/build/status/mickeypearce.oradew-vscode)](https://dev.azure.com/mickeypearce0384/Oradew/_build/latest?definitionId=1)

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
dbconfig.json           DB environments configuration (required)
oradewrc.json           Workspace configuration
```

## Commands

### Basic Workflow

**Setup**

- `Initialize Workspace/Version` - Init config files (dbconfig.json, oradewrc.json), Create workspace structure (./scripts, ./src, ./test dirs) and Init git repo when starting from scratch (new workspace). Clear logs, package and scripts: prepare workspace for a new version/feature when executed in a non-empty workspace.
- `Import All Source from DB` - Create Source files from DB objects

**Build**

- `Toggle Compile Watch` <sup>New</sup> - Start/End compilaton on save. Compile working tree automatically whenever a Source file changes.
- `Compile Changes to DB` (F6) - Compile changed Source objects (working tree). Succesfully compiled files are added to Staging area.
- `Compile Current File` - Compile Source object (or any file with a single SQL or PL/SQL statement)
- `Run Current File as Script` (F5) - Execute a SQL script (with SQLPlus)
- `Run Selected Statement` (Ctrl+Enter) - Execute a SQL query or PL/SQL statement with autoCommit and dbms_output enabled
- `Toggle Compile Watch` <sup>New</sup> - Start/End compilaton on save. Compile working tree automatically whenever a Source file changes.

**Install**

- `Package Delta` <sup>New</sup> (Shift+F9) - Package current version changes. Command extracts changed file paths from Git history - starting from latest tagged commit (last version) up to the last commit (HEAD), and then generates SQL deployment script, TODO and BOL file.
- `Package` (F9) - Generate SQL deployment script, TODO and BOL file.
- `Package Delta` <sup>New</sup> (Shift+F9) - Package current version changes. Command extracts changed file paths from Git history - starting from latest tagged commit (last version) up to the last commit (HEAD).
- `Deploy` - Run SQL deployment script on selected environment (with SQLPlus). Command prompts with environment selection.

### Additional

- `Import Changes from DB` (Shift+F6)
- `Import Current File / Import Selected Object`
- `Compile All Source to DB`
- `Run tests`
- `Generate...` PL/SQL code with a code generator.

### DB Environments

- `Set DB Environment` - Select DB environment for command execution. When option `<None>` is selected, you choose DB environment every time you execute command. Environment list is generated from `dbconfig.json` file. Three default environments (DEV, TEST, UAT) can be extended with custom environments. The default value is `DEV`.

## Configuration

Workspace supports a base configuration file (`oradewrc.json`) and an additional configuration file for each environment (`oradewrc.DEV.json`, `oradewrc.TEST.json`, `oradewrc.UAT.json`, ...). The base configuration settings apply to all environments, unless an environment specific configuration file exists that extends the base.

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
    "./scripts/**/final*.sql"
  ],
  "package.exclude": ["./**/*EXCLUDE*.sql", "./scripts/**/file*.sql"],
  "package.output": "./deploy/Run.sql",
  "package.encoding": "utf8",
  "package.templating": false,
  "source": ["./src/**/*.sql"],
  "compile.warnings": "NONE",
  "compile.force": false,
  "compile.stageFile": true,
  "version.number": "0.0.1",
  "version.description": "New feature",
  "version.releaseDate": "2099-01-01",
  "test.input": ["./test/**/*.test.sql"],
  "import.getDdlFunction": "dbms_metadata.get_ddl"
}
```

- `package.input` - Array of globs for packaging files into deployment script file (package.output). `Package Delta` command populates input with changed file paths.
- `package.output` - Deployment script file path. Created with `Package` command from concatenated input files and prepared for SQLPlus execution. (wrapped with "SPOOL deploy.log", "COMMIT;", etc )
- `package.exclude` - Array of globs for excluding files from package.input array.
- `package.encoding` - Encoding of deploy script file. (ex.: utf8, win1250, ...) The default value is `utf8`.
- `package.templating` - Turn on templating of config variables. Use existing ('\${config[\"version.releaseDate\"]}') or declare a new variable in config file and than use it in your sql file. Variables are replaced with actual values during packaging. The default value is `false`.
- `source` - Glob pattern for Source files.
- `compile.warnings` - PL/SQL compilation warning scopes. The default value is `NONE`.
- `compile.force` - Conflict detection. If object you are compiling has changed on DB (has a different DDL timestamp), you are prevented from overriding the changes with a merge step. Resolve merge conflicts if necessary and than compile again. Set to `true` to compile without conflict detection. The default value is `false`.
- `compile.stageFile` - Automatically stage file after is succesfully compiled (git add). Default value is `true`.
- `version.number` - Version number.
- `version.description` - Version description.
- `version.releaseDate` - Version release date.
- `test.input` - Array of globs for test files. Executed with `Run tests` command.
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

- SQLTools
- GitLens
- Numbered bookmarks
- Better comments
- Multiple clipboards

## Command Line

You can execute Oradew commands (gulp tasks) directly from the command line (CLI).

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
  init [options]            Initialize a new workspace
  create [options]          Import All Objects from Db to Source
  compile [options]         Compile Source files to DB
  import [options]          Import Source files from DB
  package [options]         Package files to deployment script
  deploy|run [options]      Run script (with SQLPlus)
  test [options]            Run unit tests
  generate [options]        Code generator
  watch [options]           Compile when Source file changes
```

### Example

```bash
# Create simple dbconfig file and run "Hello World" on DEV environment
> echo {"DEV": {"connectString": "localhost/orclpdb", "users": [{"user": "hr", "password": "welcome"}]}} > dbconfig.json
> oradew compile --object "select 'world' as hello from dual"

# Simple Dev Workflow
> oradew watch
> oradew package
> oradew deploy --env TEST
```
