import { promises as fs } from "fs";
import path from "path";
import process from "process";
import { execFileCapture, runCommand } from "./child-processes";
import { fileExists } from "./file-exists";
import {
  appBinaryPath,
  backendPort,
  configuredScheme,
  configuredWorkspacePath,
  derivedDataPath,
  iosConfiguration,
  logPrefix,
  mobileAppRoot,
  repoRoot,
  shouldCleanDerivedData,
} from "./mobile-screenshot-config";
import { testUserEmail, testUserPassword } from "./test-user";

const findFirstMatch = async (directory: string, suffix: string) => {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const match = entries.find(
      (entry) => entry.isDirectory() && entry.name.endsWith(suffix),
    );
    return match ? path.join(directory, match.name) : null;
  } catch {
    return null;
  }
};

const resolveWorkspacePath = async () => {
  if (configuredWorkspacePath) {
    return path.join(mobileAppRoot, configuredWorkspacePath);
  }

  const workspace = await findFirstMatch(
    path.join(mobileAppRoot, "ios"),
    ".xcworkspace",
  );
  if (workspace) {
    return workspace;
  }

  const project = await findFirstMatch(
    path.join(mobileAppRoot, "ios"),
    ".xcodeproj",
  );
  if (project) {
    return project;
  }

  throw new Error(
    "Could not find an iOS workspace or Xcode project under apps/mobile/ios",
  );
};

const resolveScheme = async (resolvedWorkspacePath: string) => {
  if (configuredScheme) {
    return configuredScheme;
  }

  const targetFlag = resolvedWorkspacePath.endsWith(".xcworkspace")
    ? "-workspace"
    : "-project";
  const targetPath = path.relative(mobileAppRoot, resolvedWorkspacePath);
  const output = await execFileCapture(
    "xcodebuild",
    [targetFlag, targetPath, "-list", "-json"],
    {
      cwd: mobileAppRoot,
      env: process.env,
    },
  );
  const parsed = JSON.parse(output) as {
    workspace?: { schemes?: string[] };
    project?: { schemes?: string[] };
  };
  const schemes = parsed.workspace?.schemes ?? parsed.project?.schemes ?? [];
  const preferredSchemes = ["alliancemobile", "Alliance"];

  for (const preferred of preferredSchemes) {
    const match = schemes.find((scheme) => scheme === preferred);
    if (match) {
      return match;
    }
  }

  if (schemes.length > 0) {
    return schemes[0];
  }

  throw new Error(
    `Could not find an Xcode scheme for ${resolvedWorkspacePath}`,
  );
};

export const buildIosApp = async (udid: string) => {
  console.log(`${logPrefix} Building iOS simulator app...`);
  if (shouldCleanDerivedData) {
    await fs.rm(derivedDataPath, { recursive: true, force: true });
  }
  const resolvedWorkspacePath = await resolveWorkspacePath();
  const resolvedScheme = await resolveScheme(resolvedWorkspacePath);
  const buildTargetFlag = resolvedWorkspacePath.endsWith(".xcworkspace")
    ? "-workspace"
    : "-project";
  const buildTargetPath = path.relative(mobileAppRoot, resolvedWorkspacePath);
  const simulatorArch = process.arch === "arm64" ? "arm64" : "x86_64";

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "production",
    RCT_NO_LAUNCH_PACKAGER: "1",
    EXPO_PUBLIC_VISUAL_TEST: "true",
    EXPO_PUBLIC_VISUAL_TEST_API_URL:
      process.env.EXPO_PUBLIC_VISUAL_TEST_API_URL ??
      `http://127.0.0.1:${backendPort}`,
    EXPO_PUBLIC_VISUAL_TEST_EMAIL:
      process.env.EXPO_PUBLIC_VISUAL_TEST_EMAIL ?? testUserEmail,
    EXPO_PUBLIC_VISUAL_TEST_PASSWORD:
      process.env.EXPO_PUBLIC_VISUAL_TEST_PASSWORD ?? testUserPassword,
  };

  const buildArgs = [
    buildTargetFlag,
    buildTargetPath,
    "-scheme",
    resolvedScheme,
    "-configuration",
    iosConfiguration,
    "-destination",
    `platform=iOS Simulator,id=${udid}`,
    "-derivedDataPath",
    derivedDataPath,
    "ONLY_ACTIVE_ARCH=YES",
    `ARCHS=${simulatorArch}`,
    "COMPILER_INDEX_STORE_ENABLE=NO",
    "build",
  ];

  try {
    await runCommand("xcodebuild", buildArgs, {
      cwd: mobileAppRoot,
      env,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('build.db": database is locked')
    ) {
      console.warn(
        `${logPrefix} Derived data was locked. Cleaning ${derivedDataPath} and retrying build once.`,
      );
      await fs.rm(derivedDataPath, { recursive: true, force: true });
      await runCommand("xcodebuild", buildArgs, {
        cwd: mobileAppRoot,
        env,
      });
    } else {
      throw error;
    }
  }

  if (!(await fileExists(appBinaryPath))) {
    throw new Error(`Built app not found at ${appBinaryPath}`);
  }
};

export const ensureIosWorkspace = async () => {
  const iosDir = path.join(mobileAppRoot, "ios");
  const existingWorkspace = await findFirstMatch(iosDir, ".xcworkspace");
  const existingProject = await findFirstMatch(iosDir, ".xcodeproj");
  if (existingWorkspace || existingProject) {
    return;
  }

  console.log(
    `${logPrefix} Native iOS workspace missing. Running Expo prebuild...`,
  );
  await runCommand("bun", ["x", "expo", "prebuild", "--platform", "ios"], {
    cwd: path.join(repoRoot, "apps", "mobile"),
    env: {
      ...process.env,
      CI: "true",
    },
  });

  const generatedWorkspace = await findFirstMatch(iosDir, ".xcworkspace");
  const generatedProject = await findFirstMatch(iosDir, ".xcodeproj");
  if (!generatedWorkspace && !generatedProject) {
    throw new Error(
      `Expo prebuild completed but no Xcode workspace/project was generated under ${iosDir}`,
    );
  }
};
