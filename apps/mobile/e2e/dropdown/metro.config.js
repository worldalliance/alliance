const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

const config = getDefaultConfig(__dirname);
const repo = path.resolve(__dirname, "../../../..");
config.watchFolders = [repo];
config.resolver.nodeModulesPaths = [path.join(repo, "node_modules")];

module.exports = withUniwindConfig(config, {
  cssEntryFile: "../../global.css",
  dtsFile: "../../uniwind-types.d.ts",
});
