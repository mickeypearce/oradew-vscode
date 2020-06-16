// Imports make type with errors for functions
const gulp = require("gulp");

import { packageTask } from "./tasks/package";
import { initTask } from "./tasks/init";
import { importTask } from "./tasks/import";
import { runTask } from "./tasks/run";
import { compileTask, compileOnSaveTask, compileTestTask } from "./tasks/compile";
import { generateTask } from "./tasks/generate";
import { createTask } from "./tasks/create";

gulp.task("init", initTask);
gulp.task("create", createTask);

gulp.task("compile", compileTask);
gulp.task("compileOnSave", compileOnSaveTask);
gulp.task("watch", compileOnSaveTask); //Alias
gulp.task("test", compileTestTask);

gulp.task("import", importTask);

gulp.task("package", packageTask);

gulp.task("run", runTask);
gulp.task("deploy", runTask); //Alias

gulp.task("generate", generateTask);
