# Oradew for VS Code

PL/SQL development with a simple compile-package-deploy workflow. Compile with ORA errors and warnings problem matching, conflict detection with auto-merging (git), distribution script packaging and deployment.

## Structure

```
oradewrc.json           Workspace configuration
dbconfig.json           DB connection configuration
./scripts               Deployment scripts (DDL, DML, etc)
./src                   Source with PL/SQL objects (FUNCTIONS, PACKAGES, PROCEDURES, VIEWS, TRIGGERS, TYPES)
./deploy                Distribution package
./test                  Unit tests
```

## Basic Workflow

### **Setup**

- `Initialize Workspace/Version` - Clean and initialize workspace configuration
- `Create Source from DB Objects` - Create Source structure from DEV DB objects

### **Build**

- `Compile Changes to DB` (F6) - Compile changed Source objects (working tree) to DEV. Succesfully compiled files are added to Staging area.
- `Compile Current File` - Compile file to DEV
- `Run Current File as Script` (F5) - Run as Script to DEV (with SQLPlus)

### **Install**

- `Package` (F8) - Generate distribution package script
- `Deploy to TEST or UAT` - Deploy dist package script to TEST or UAT (with SQLPlus)

## Additional Commands

- `Import Changes from DB` (Shift + F6)
- `Import Current File / Import Selected Object`
- `Compile All Source to DB`
- `Run tests` (F7)

## Important

> `Oracle driver (node-oracledb) in extension is precompiled with "node-v59 (Node.js 9) - win32 - x64 (64bit)" binary package.`

Oracle client library architecture (instantclient), Node.js version, OS and architecture must match precompiled configuration otherwise node-oracledb drivers have to be rebuild.

```bash
## Rebuild Oracle drivers (in ext folder ~/.vscode/extensions/mp.oradew-vscode-...):
> npm rebuild
```

I hope you find it useful. Your feedback is highly appreciated.
