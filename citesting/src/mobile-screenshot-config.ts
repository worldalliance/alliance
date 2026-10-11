import path from "path";
import process from "process";
import { mobileScreenshotTargets } from "./mobile-screenshot-targets";
import { screenshotDatabase } from "./screenshot-database";

export const repoRoot = path.resolve(__dirname, "..", "..");
export const backendPort = Number(process.env.SERVER_PORT ?? "3105");
const rawOutputDir =
  process.env.SCREENSHOT_OUTPUT_DIR ??
  path.join(
    repoRoot,
    "citesting",
    "screenshots-mobile",
    new Date().toISOString().replace(/[:.]/g, "-"),
  );
export const outputDir = path.isAbsolute(rawOutputDir)
  ? rawOutputDir
  : path.join(repoRoot, rawOutputDir);
export const derivedDataPath = path.isAbsolute(
  process.env.IOS_DERIVED_DATA_PATH ?? "",
)
  ? (process.env.IOS_DERIVED_DATA_PATH as string)
  : path.join(
      repoRoot,
      process.env.IOS_DERIVED_DATA_PATH ?? "citesting/ios-derived-data",
    );

export const preferredSimulatorNames = (
  process.env.IOS_SIMULATOR_NAME
    ? [process.env.IOS_SIMULATOR_NAME]
    : ["iPhone 16", "iPhone 17", "iPhone 15", "iPhone 15 Pro", "iPhone 17 Pro"]
).filter(Boolean) as string[];
export const bundleId =
  process.env.IOS_BUNDLE_ID ?? "com.alliancefoundation.alliancemobile";
export const configuredScheme = process.env.IOS_SCHEME;
export const configuredWorkspacePath = process.env.IOS_WORKSPACE_PATH;
export const iosConfiguration = process.env.IOS_CONFIGURATION ?? "Release";
export const shouldCleanDerivedData = process.env.IOS_CLEAN_BUILD === "true";
export const appBinaryPath =
  process.env.IOS_APP_BINARY_PATH ??
  path.join(
    derivedDataPath,
    "Build",
    "Products",
    `${iosConfiguration}-iphonesimulator`,
    "Alliance.app",
  );

export const dbName = screenshotDatabase();
const requestedTargetNames = (process.env.SCREENSHOT_TARGETS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export const logPrefix = "[citesting:mobile-ios]";
export const mobileAppRoot = path.join(repoRoot, "apps", "mobile");

export const selectedTargets =
  requestedTargetNames.length > 0
    ? mobileScreenshotTargets.filter((target) =>
        requestedTargetNames.includes(target.name),
      )
    : mobileScreenshotTargets;
