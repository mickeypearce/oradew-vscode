# Oradew

**PL/SQL development with Git and a simple compile-package-deploy workflow**

This extension allows you to develop your PL/SQL project in Visual Studio Code. It enables you to:

- Manage PL/SQL source code with version control (Git)
- Compile files and Run statements<sup>New</sup> with ORA errors problem matching
- Package files in a single distributable script and deploy

![Compile Demo](images/demo.gif)

## Workspace Structure

```
oradewrc.json           Workspace configuration
dbconfig.json           DB connection configuration
./scripts               Deployment scripts (DDL, DML, etc)
./src                   Source with PL/SQL objects (FUNCTIONS, PACKAGES, PROCEDURES, TABLES, TRIGGERS, TYPES, VIEWS)
./deploy                Distribution package
./test                  Unit tests
```

## Basic Workflow

### **Setup**

- `Initialize Workspace/Version` - Initialize/clean workspace structure and configuration
- `Create Source from DB Objects` - Create Source structure from DEV DB objects

### **Build**

- `Compile Changes to DB` (F6) - Compile changed Source objects (working tree) to DEV. Succesfully compiled files are added to Staging area.
- `Compile Current File` - Compile file to DEV
- `Run Current File as Script` (F5) - Run as Script to DEV (with SQLPlus)
- `Run Selected Statement` (Shift+Enter) - Executes a single SQL or PL/SQL statement with autoCommit and dbms_output enabled.

### **Install**

- `Package` (F8) - Generate distribution package script
- `Deploy to TEST or UAT` - Deploy dist package script to TEST or UAT (with SQLPlus)

## Additional Commands

- `Import Changes from DB` (Shift + F6)
- `Import Current File / Import Selected Object`
- `Compile All Source to DB`
- `Run tests` (F7)
- `Populate Package Input` - with changed files from Git history using latest tagged commit as a starting point. (Shift + F8)

## Important

### Prerequisites

- Node.js
- Git
- SQLPlus

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
