# Oradew for VS Code

PL/SQL development with a simple compile-package-deploy workflow. Compile with ORA errors and warnings problem matching, conflict detection with auto-merging (git), distribution script packaging and deployment.

## Structure

```
oradewrc.json           Workspace configuration
dbconfig.json           DB connection configuration
./scripts               Deployment scripts (DDL, DML, etc)
./src                   Source with PL/SQL objects (FUNCTIONS, PACKAGES, PROCEDURES, VIEWS)
./deploy                Distribution package
```

## Basic Workflow

### **Setup**

* `Initialize Workspace/Version` - Clean and initialize workspace configuration
* `Create Source from DB Objects` - Create Source structure from DEV DB objects

### **Build**

* `Compile Changes to DB` (F6) - Compile changed Source objects (working tree) to DEV. Succesfully compiled files are added to Staging area.
* `Compile Current File` - Compile file to DEV
* `Run Current File as Script` (F5) - Run as Script to DEV (with SQLPlus)

### **Install**

* `Package` (F8) - Generate distribution package script
* `Deploy to TEST or UAT` - Deploy dist package script to TEST or UAT (with SQLPlus)

## Important

Oracle driver architecture (ia32 or x64) must match Node architecture (x86 or x64), otherwise oracle drivers have to be rebuild:

> npm rebuild
