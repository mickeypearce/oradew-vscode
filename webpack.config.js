/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

"use strict";

const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

/**@type {import('webpack').Configuration}*/
const config = {
  target: "node", // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
  // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  entry: {
    extension: "./src/extension.ts",
    gulpfile: "./src/gulpfile.ts",
    cli: "./src/cli/cli.ts",
    // "gulp-cli": "./src/gulp-cli.ts",
  },
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    libraryTarget: "commonjs2",
    devtoolModuleFilenameTemplate: "../[resource-path]",
  },
  node: {
    // __dirname: true, // leave the __dirname behavior intact
    __dirname: false,
    __filename: false,
  },
  devtool: "source-map",
  externals: {
    vscode: "commonjs vscode", // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
    oracledb: "commonjs oracledb",
    // "vscode-extension-telemetry": "commonjs vscode-extension-telemetry", // commonly used
    // yargs: "commonjs2 yargs",
    gulp: "commonjs2 gulp",
    "gulp-git": "commonjs2 gulp-git",
    "gulp-todo": "commonjs2 gulp-todo",
    // // "gulp-template": "commonjs2 gulp-template",
    // "gulp-group-concat": "commonjs2 gulp-group-concat",
    // // "gulp-noop": "commonjs2 gulp-noop",
    // // "gulp-convert-encoding": "commonjs2 gulp-convert-encoding",
    // "vinyl-map2": "commonjs2 vinyl-map2",
    // "gulp-cli": "commonjs2 gulp-cli",
    // "rechoir": "commonjs2 rechoir",
    // "interpret": "commonjs2 interpret",
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: [".ts", ".js", ".json"],
    // alias: {
    //   Resources: path.resolve(__dirname, "src/resources/"),
    // './': 'handlebars/dist/handlebars.js'
    // },
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: "src/resources", to: "resources" },
        { from: "src/cli/oradew.js", to: "oradew.js" },
        // { from: "src/gulp.js", to: "gulp.js" },
        // {
        //   from: "lib/versioned/**",
        //   to: "",
        //   context: "node_modules/gulp-cli/",
        // },
      ],
    }),
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            // options: {
            //   compilerOptions: {
            //     "module": "es6", // override `tsconfig.json` so that TypeScript emits native JavaScript modules.
            //   },
            // },
          },
        ],
      },
    ],
  },
  optimization: {
    minimize: false,
  },
  // stats: {
  //   // Ignore warnings due to yarg's dynamic module loading
  //   warningsFilter: [/node_modules\/yargs/],

  // },
  // stats: "errors-only",
};

module.exports = config;
