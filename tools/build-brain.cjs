const path = require("path");
const esbuild = require(
  process.env.STILL_BUILD_DIR
    ? process.env.STILL_BUILD_DIR + "/node_modules/esbuild"
    : "esbuild",
);
esbuild.buildSync({
  entryPoints: ["brain3d.js"],
  bundle: true,
  format: "iife",
  outfile: "assets/brain3d.bundle.js",
  minify: true,
  legalComments: "eof",
  nodePaths: [
    process.env.STILL_BUILD_DIR
      ? process.env.STILL_BUILD_DIR + "/node_modules"
      : path.resolve("node_modules"),
  ],
});
