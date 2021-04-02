# Change Log

## [0.3.28] - 2021-04-02

- Minor fixes

## [0.3.27] - 2020-12-06

- Added setting "oradew.cliCommand" [#50](https://github.com/mickeypearce/oradew-vscode/issues/50)

## [0.3.26] - 2020-11-16

- Fixed bug [#43](https://github.com/mickeypearce/oradew-vscode/issues/43)

## [0.3.25] - 2020-10-23

- Added compatibility for APEX applications [#39](https://github.com/mickeypearce/oradew-vscode/issues/39) (thanks, @yevon)

## [0.3.24] - 2020-07-10

- Enabled ".SQL" filename extension [#35](https://github.com/mickeypearce/oradew-vscode/issues/35)

## [0.3.23] - 2020-07-03

- Added "askForPassword" to DB users (dbconfig.json) [#34](https://github.com/mickeypearce/oradew-vscode/issues/34)

## [0.3.22] - 2020-06-05

- Added multi-schema packaging (schema based deployment scripts)
- Added script selection to Deploy command

## [0.3.20] - 2020-05-22

- Added "Set DB User" command

## [0.3.19] - 2020-05-14

- Added "oradew" task contribution

## [0.3.18] - 2020-05-07

- Minor bug fixes and changes

## [0.3.17] - 2020-02-11

- Upgraded init command

## [0.3.16] - 2020-01-08

- Added setting for environment variables: "oradew.envVariables" (ex.: "NLS_LANG", "ORACLE_HOME", etc) [#28](https://github.com/mickeypearce/oradew-vscode/issues/28)

## [0.3.15] - 2019-12-06

- Upgraded node-oracledb to v4.1.0

## [0.3.14] - 2019-11-08

- Added synonyms to source objects [#31](https://github.com/mickeypearce/oradew-vscode/issues/31)

## [0.3.13] - 2019-10-25

- Added problem matcher for scripts and SQLcl as a default CLI [#28](https://github.com/mickeypearce/oradew-vscode/issues/28)

## [0.3.12] - 2019-10-04

- Added configuration for custom source structure [#27](https://github.com/mickeypearce/oradew-vscode/issues/27)

## [0.3.11] - 2019-07-25

- Maintanance

## [0.3.10] - 2019-05-25

- Check prerequisites on startup [#23](https://github.com/mickeypearce/oradew-vscode/issues/23)
- Added telemetry on command's usage

## [0.3.9] - 2019-05-15

- Added "source.encoding" config [#21](https://github.com/mickeypearce/oradew-vscode/issues/21)

## [0.3.8] - 2019-05-08

- Fix importing all source [#20](https://github.com/mickeypearce/oradew-vscode/issues/20)

## [0.3.7] - 2019-04-12

- Rename "source" to "source.input" config
- Fix "cli-install" when run from extension directory

## [0.3.6] - 2019-04-04

- Added "Package Delta" command for packaging version changes
- Added "package.exclude" config parameter
- Added "Clear DB Environment" command

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
