# Change Log

## [0.1.3] - 2018-10-05

- Added "import.getDdlFunction" configuration: Use a custom DB function to import object's DDL.
- Added Tables to Source objects
- Added "Run Selected Statement" (Shift+Enter) command: Execute SQL and PL/SQL statements.

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
