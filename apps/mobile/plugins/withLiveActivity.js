const { withDangerousMod, withXcodeProject } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const WIDGET_TARGET = "ExpoWidgetsTarget";
const SWIFT_FILES = [
  "ActionDeadlineAttributes.swift",
  "ActionDeadlineLiveActivity.swift",
];

/**
 * Config plugin that injects custom Live Activity Swift files into the
 * ExpoWidgetsTarget created by expo-widgets.
 *
 * Must run AFTER expo-widgets in the plugins array.
 */
function withLiveActivity(config) {
  // Step 1: Copy Swift files into the widget target directory and patch index.swift
  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const targetDir = path.join(projectRoot, WIDGET_TARGET);
      const widgetsDir = path.resolve(__dirname, "..", "widgets");

      if (!fs.existsSync(targetDir)) {
        console.warn(
          "[withLiveActivity] ExpoWidgetsTarget directory not found, skipping"
        );
        return config;
      }

      // Copy Swift files into the widget target
      for (const file of SWIFT_FILES) {
        const src = path.join(widgetsDir, file);
        const dest = path.join(targetDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        } else {
          console.warn(`[withLiveActivity] Source file not found: ${src}`);
        }
      }

      // Patch index.swift to include our ActionDeadlineLiveActivity
      const indexPath = path.join(targetDir, "index.swift");
      if (fs.existsSync(indexPath)) {
        let content = fs.readFileSync(indexPath, "utf8");
        if (!content.includes("ActionDeadlineLiveActivity")) {
          // Insert our live activity next to the existing WidgetLiveActivity()
          content = content.replace(
            "WidgetLiveActivity()",
            "WidgetLiveActivity()\n    ActionDeadlineLiveActivity()"
          );
          fs.writeFileSync(indexPath, content);
        }
      }

      return config;
    },
  ]);

  // Step 2: Add the Swift files to the Xcode widget target build sources
  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const targetDir = path.join(
      config.modRequest.platformProjectRoot,
      WIDGET_TARGET
    );

    // Find the widget target key in the native targets
    const nativeTargets = xcodeProject.pbxNativeTargetSection();
    let widgetTargetKey = null;

    for (const key of Object.keys(nativeTargets)) {
      if (key.endsWith("_comment")) continue;
      const target = nativeTargets[key];
      if (target.name === WIDGET_TARGET) {
        widgetTargetKey = key;
        break;
      }
    }

    if (!widgetTargetKey) {
      console.warn(
        "[withLiveActivity] Could not find ExpoWidgetsTarget in Xcode project"
      );
      return config;
    }

    // Find the sources build phase for this target
    const target = nativeTargets[widgetTargetKey];
    const buildPhases = target.buildPhases || [];
    let sourcesBuildPhaseId = null;

    for (const phase of buildPhases) {
      if (phase.comment && phase.comment.includes("Sources")) {
        sourcesBuildPhaseId = phase.value;
        break;
      }
    }

    if (!sourcesBuildPhaseId) {
      console.warn(
        "[withLiveActivity] Could not find Sources build phase for widget target"
      );
      return config;
    }

    // Add each Swift file to the PBX group and build sources
    for (const fileName of SWIFT_FILES) {
      const filePath = path.join(targetDir, fileName);
      if (!fs.existsSync(filePath)) continue;

      // Check if file already exists in the project
      const fileRefs = xcodeProject.pbxFileReferenceSection();
      let existingRef = null;
      for (const refKey of Object.keys(fileRefs)) {
        if (refKey.endsWith("_comment")) continue;
        const ref = fileRefs[refKey];
        if (ref.name === `"${fileName}"` || ref.path === `"${fileName}"`) {
          existingRef = refKey;
          break;
        }
      }

      if (existingRef) continue; // Already added

      // Add file reference
      const fileRefUuid = xcodeProject.generateUuid();
      xcodeProject.addToPbxFileReferenceSection({
        uuid: fileRefUuid,
        basename: fileName,
        path: fileName,
        sourceTree: '"<group>"',
        fileEncoding: 4,
        lastKnownFileType: "sourcecode.swift",
      });

      // Add to build file section
      const buildFileUuid = xcodeProject.generateUuid();
      xcodeProject.addToPbxBuildFileSection({
        uuid: buildFileUuid,
        basename: fileName,
        group: "Sources",
        fileRef: fileRefUuid,
      });

      // Add to sources build phase
      const sourcesBuildPhase =
        xcodeProject.pbxSourcesBuildPhaseSection()[sourcesBuildPhaseId];
      if (sourcesBuildPhase && sourcesBuildPhase.files) {
        sourcesBuildPhase.files.push({
          value: buildFileUuid,
          comment: `${fileName} in Sources`,
        });
      }

      // Add to the PBX group for ExpoWidgetsTarget
      const groups = xcodeProject.pbxGroupByName(WIDGET_TARGET);
      if (groups) {
        if (!groups.children) groups.children = [];
        groups.children.push({
          value: fileRefUuid,
          comment: fileName,
        });
      }
    }

    return config;
  });

  return config;
}

module.exports = withLiveActivity;
