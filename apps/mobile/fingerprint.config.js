const { SourceSkips } = require("@expo/fingerprint");

/**
 * Defines OTA `runtimeVersion` (policy: "fingerprint"). CI compares this
 * native-compatibility hash with live store baselines in
 * `common/src/mobileFingerprints.gen.ts`; native changes need store builds.
 *
 * Skips only inputs that do not affect native/OTA compatibility:
 *   - PackageJsonScriptsAll: build tooling.
 *   - ExpoConfigVersions: release numbers change each build, but OTAs must
 *     still patch already-shipped builds.
 *   - GitIgnore: scopes file walks; cannot change native output.
 *
 * Keep dependencies and native config included so OTA never targets missing
 * native modules. Changing skips changes hashes; ship with a store build.
 *
 * eas.json is hashed without its staging profiles, so they leave production's
 * hash as the stores have it. Staging's hash still differs through its app
 * config.
 */
let easJson = "";

module.exports = {
  sourceSkips:
    SourceSkips.PackageJsonScriptsAll |
    SourceSkips.ExpoConfigVersions |
    SourceSkips.GitIgnore,
  fileHookTransform: (source, chunk, isEndOfFile) => {
    if (source.type !== "file" || source.filePath !== "eas.json") {
      return chunk;
    }
    if (!isEndOfFile) {
      easJson += chunk;
      return null;
    }
    const config = JSON.parse(easJson);
    easJson = "";
    delete config.build.staging;
    delete config.submit.staging;
    return `${JSON.stringify(config, null, 2)}\n`;
  },
};
