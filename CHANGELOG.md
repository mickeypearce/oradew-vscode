# Change Log

## [0.3.4] - 2019-04-04

- Added "Package Delta" command for packaging version changes
- Added "package.exclude" config parameter

## [0.3.3] - 2019-03-27

- Simplify CLI commands

## [0.3.1] - 2019-03-19

- Added "Toggle Compile Watch" command for compiling on save
- Added "compile.stageFile" configuration
- Added setting to print additional info from tasks: "oradew.chatty"

## [0.3.0] - 2019-03-05

- Added "Set DB Environment" command and status bar indicator [#17](https://github.com/mickeypearce/oradew-vscode/issues/17)
- Added setting for global dbconfig file: "oradew.databaseConfigFile" [#17](https://github.com/mickeypearce/oradew-vscode/issues/17)
- Added version number to deployment package

## [0.2.0] - 2019-02-06

- !!! Upgraded node-oracledb to v3.1.1 which INCLUDES pre-built binaries for Node 6, 8, 10 and 11. [#15](https://github.com/mickeypearce/oradew-vscode/issues/15)
  - You may have to upgrade Node, if your version (e.g. 9) is no longer supported.
- Generators have a separate config file (oradewrc-generate.json)
- Added "disabled" and "schemas" properties to DB users (dbconfig.json)

## [0.1.8] - 2019-01-17

- Generate BOL instead of ChangeLog file
- Added ENV names to spooled logs (deploy)
- Keybinding (ctrl+alt+enter) to re-run last command

## [0.1.7] - 2018-12-12

- Added command line (CLI) [#11](https://github.com/mickeypearce/oradew-vscode/issues/11)

## [0.1.6] - 2018-11-27

- Added "Compile" commands for UAT, bug fixes...

## [0.1.5] - 2018-11-02

- Added environment-specific configurations [#10](https://github.com/mickeypearce/oradew-vscode/issues/10)
- Added PL/SQL code generators ("Generate" command)
- Fixed keybinding conflicts and activations [#12](https://github.com/mickeypearce/oradew-vscode/issues/12)

## [0.1.4] - 2018-10-12

- Added "import.getDdlFunction" configuration: Use a custom DB function to import object's DDL.
- Added Tables to Source objects
- Added "Run Selected Statement" (Ctrl+Enter) command: Execute SQL and PL/SQL statements.
- Added default values for settings (oradewrc.json)

## [0.1.2] - 2018-09-06

- Added "Populate Package Input" command
- Added "Edit db configuration" and "Use default workspace configuration" option to Initialize command

## [0.1.1] - 2018-08-07

- Fixed spaces in workspace folder path [#5](https://github.com/mickeypearce/oradew-vscode/issues/5)

## [0.1.0] - 2018-07-04

- Added multi-schema support [PR #8](https://github.com/mickeypearce/oradew-vscode/issues/8)

## [0.0.5] - 2018-06-08

- Added Types to object types [PR #7](https://github.com/mickeypearce/oradew-vscode/issues/7) (thanks, @chambery)
- Added Import Selected Object [#4](https://github.com/mickeypearce/oradew-vscode/issues/4)

## [0.0.4] - 2018-05-22

- !!! Upgraded node-oracledb binary to Node.js 9 - win32 - x64.
- Added "compile.force" parameter
- Added json schema to oradewrc.json config file
- Added triggers to object types

## [0.0.3] - 2018-05-03

- Added "DEFINE OFF" to generated package script
- Added Run Test command
- Preserve exported objects DB data (moved to storagePath)

## [0.0.2] - 2018-04-20

- Added "package.template" parameter
