//@ts-check

"use strict";

const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

/**@type {import('webpack').Configuration}*/
const config = {
  target: "node", // vscode extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/
  // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  entry: {
    extension: "./src/extension/extension.ts",
    gulpfile: "./src/cli/gulpfile.ts",
    cli: "./src/cli/cli.ts",
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
    gulp: "commonjs2 gulp",
    // @todo move them to internal or replace
    "gulp-git": "commonjs2 gulp-git",
    "gulp-todo": "commonjs2 gulp-todo",
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: [".ts", ".js", ".json"],
    // alias: {
    //   Resources: path.resolve(__dirname, "src/schemas/"),
    // './': 'handlebars/dist/handlebars.js'
    // },
  },
  plugins: [
    new CleanWebpackPlugin(),
    new CopyPlugin({
      patterns: [
        { from: "src/cli/schemas", to: "schemas" },
        { from: "src/cli/oradew.js", to: "oradew.js" },
        { from: "src/extension/images", to: "images" },
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
