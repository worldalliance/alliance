import { execFile, spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import process from "process";
import { mobileScreenshotTargets } from "./mobile-screenshot-targets";
import { screenshotDatabase } from "./screenshot-database";
import { testUserEmail, testUserPassword } from "./test-user";

type ChildProcessHandle = ReturnType<typeof spawn>;

type SpawnOptions = {
  cwd: string;
  env?: NodeJS.ProcessEnv;
};

const repoRoot = path.resolve(__dirname, "..", "..");
const backendPort = Number(process.env.SERVER_PORT ?? "3105");
const rawOutputDir =
  process.env.SCREENSHOT_OUTPUT_DIR ??
  path.join(
    repoRoot,
    "citesting",
    "screenshots-mobile",
    new Date().toISOString().replace(/[:.]/g, "-"),
  );
const outputDir = path.isAbsolute(rawOutputDir)
  ? rawOutputDir
  : path.join(repoRoot, rawOutputDir);
const derivedDataPath = path.isAbsolute(process.env.IOS_DERIVED_DATA_PATH ?? "")
  ? (process.env.IOS_DERIVED_DATA_PATH as string)
  : path.join(
      repoRoot,
      process.env.IOS_DERIVED_DATA_PATH ?? "citesting/ios-derived-data",
    );

const preferredSimulatorNames = (
  process.env.IOS_SIMULATOR_NAME
    ? [process.env.IOS_SIMULATOR_NAME]
    : ["iPhone 16", "iPhone 17", "iPhone 15", "iPhone 15 Pro", "iPhone 17 Pro"]
).filter(Boolean) as string[];
const bundleId =
  process.env.IOS_BUNDLE_ID ?? "com.alliancefoundation.alliancemobile";
const configuredScheme = process.env.IOS_SCHEME;
const configuredWorkspacePath = process.env.IOS_WORKSPACE_PATH;
const iosConfiguration = process.env.IOS_CONFIGURATION ?? "Release";
const shouldCleanDerivedData = process.env.IOS_CLEAN_BUILD === "true";
const appBinaryPath =
  process.env.IOS_APP_BINARY_PATH ??
  path.join(
    derivedDataPath,
    "Build",
    "Products",
    `${iosConfiguration}-iphonesimulator`,
    "Alliance.app",
  );

const dbHost = process.env.DB_HOST ?? "localhost";
const dbPort = process.env.DB_PORT ?? "5432";
const dbUser = process.env.DB_USERNAME ?? "postgres";
const dbPass = process.env.DB_PASSWORD ?? "postgres";
const dbName = screenshotDatabase();
const requestedTargetNames = (process.env.SCREENSHOT_TARGETS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const childProcesses: ChildProcessHandle[] = [];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const logPrefix = "[citesting:mobile-ios]";
const mobileAppRoot = path.join(repoRoot, "apps", "mobile");

const sanitizeFileName = (value: string) =>
  value
    .replace(/^\//, "")
    .replace(/\//g, "-")
    .replace(/[^a-zA-Z0-9-_.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "screen";

const selectedTargets =
  requestedTargetNames.length > 0
    ? mobileScreenshotTargets.filter((target) =>
        requestedTargetNames.includes(target.name),
      )
    : mobileScreenshotTargets;

const trackChildProcess = (child: ChildProcessHandle) => {
  childProcesses.push(child);
  child.on("close", () => {
    const index = childProcesses.indexOf(child);
    if (index >= 0) {
      childProcesses.splice(index, 1);
    }
  });
  return child;
};

const spawnProcess = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => {
  return trackChildProcess(
    spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      detached: process.platform !== "win32",
      stdio: "inherit",
    }),
  );
};

const execFileCapture = (
  command: string,
  args: string[],
  options: SpawnOptions,
) =>
  new Promise<string>((resolve, reject) => {
    execFile(
      command,
      args,
      { cwd: options.cwd, env: options.env },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve(stdout);
      },
    );
  });

const runCommand = (command: string, args: string[], options: SpawnOptions) =>
  new Promise<void>((resolve, reject) => {
    const child = trackChildProcess(
      spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        stdio: "inherit",
      }),
    );

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
      }
    });
  });

const tryRunCommand = async (
  command: string,
  args: string[],
  options: SpawnOptions,
) => {
  try {
    await runCommand(command, args, options);
  } catch {
    // Ignore best-effort commands.
  }
};

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

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

const killProcess = async (child: ChildProcessHandle) => {
  if (!child.pid || child.killed) {
    return;
  }

  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, "SIGTERM");
      return;
    } catch {
      // Fall back to regular kill below.
    }
  }

  try {
    child.kill("SIGTERM");
  } catch {
    return;
  }
};

const shutdown = async (code: number) => {
  await Promise.all(childProcesses.map((child) => killProcess(child)));
  await delay(1000);
  await Promise.all(
    childProcesses.map(async (child) => {
      if (!child.killed) {
        try {
          child.kill("SIGKILL");
        } catch {
          // Ignore.
        }
      }
    }),
  );
  process.exit(code);
};

const waitForHttp = async (url: string, timeoutMs: number) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) {
        return;
      }
    } catch {
      // Ignore until timeout.
    }
    await delay(1000);
  }
  throw new Error(`Timed out waiting for ${url}`);
};

/* ------------------------------------------------------------------ */
/*  Database setup                                                     */
/* ------------------------------------------------------------------ */

const setupDatabase = async () => {
  console.log(`${logPrefix} Setting up database "${dbName}"...`);

  const pgEnv: NodeJS.ProcessEnv = { ...process.env, PGPASSWORD: dbPass };
  const psqlBase = ["-h", dbHost, "-p", dbPort, "-U", dbUser];

  await runCommand(
    "psql",
    [
      ...psqlBase,
      "-d",
      "postgres",
      "-c",
      `DROP DATABASE IF EXISTS "${dbName}"`,
    ],
    { cwd: repoRoot, env: pgEnv },
  );
  await runCommand(
    "psql",
    [...psqlBase, "-d", "postgres", "-c", `CREATE DATABASE "${dbName}"`],
    { cwd: repoRoot, env: pgEnv },
  );

  console.log(`${logPrefix} Running migrations...`);
  await runCommand(
    "bunx",
    [
      "typeorm-ts-node-commonjs",
      "--dataSource",
      "src/datasources/dataSource.ts",
      "migration:run",
    ],
    {
      cwd: path.join(repoRoot, "server"),
      env: {
        ...process.env,
        DB_HOST: dbHost,
        DB_PORT: dbPort,
        DB_USERNAME: dbUser,
        DB_PASSWORD: dbPass,
        DB_NAME: dbName,
        NODE_ENV: "test",
      },
    },
  );

  console.log(`${logPrefix} Loading seed dump...`);
  await loadSeedData(psqlBase, pgEnv);

  console.log(`${logPrefix} Shifting timestamps to current date...`);
  await shiftTimestamps(psqlBase, pgEnv);
};

const loadSeedData = async (psqlBase: string[], pgEnv: NodeJS.ProcessEnv) => {
  const seedFile = path.join(
    repoRoot,
    "citesting",
    "fixtures",
    "seed_dataonly.sql",
  );
  let seedContent = await fs.readFile(seedFile, "utf8");

  seedContent = seedContent
    .split("\n")
    .filter((line) => {
      if (/^SET\s+transaction_timeout\s*=/i.test(line)) return false;
      if (/^\\restrict\b/.test(line)) return false;
      if (/^\\unrestrict\b/.test(line)) return false;
      return true;
    })
    .join("\n");

  return new Promise<void>((resolve, reject) => {
    const child = spawn(
      "psql",
      [...psqlBase, "-d", dbName, "-v", "ON_ERROR_STOP=1"],
      {
        cwd: repoRoot,
        env: pgEnv,
        stdio: ["pipe", "inherit", "inherit"],
      },
    );

    child.stdin.write("SET session_replication_role = 'replica';\n");
    child.stdin.write(seedContent);
    child.stdin.write("\nSET session_replication_role = 'origin';\n");
    child.stdin.end();

    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`psql seed loading failed with exit code ${code}`));
    });
  });
};

const SEED_REFERENCE_DATE = "2026-02-10T18:00:00Z";

const shiftTimestamps = async (
  psqlBase: string[],
  pgEnv: NodeJS.ProcessEnv,
) => {
  const sql = `
    DO $$
    DECLARE
      r RECORD;
      delta INTERVAL := NOW() - '${SEED_REFERENCE_DATE}'::timestamptz;
    BEGIN
      FOR r IN
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND data_type IN ('timestamp with time zone',
                            'timestamp without time zone')
      LOOP
        EXECUTE format(
          'UPDATE %I SET %I = %I + $1 WHERE %I IS NOT NULL',
          r.table_name, r.column_name, r.column_name, r.column_name
        ) USING delta;
      END LOOP;
    END
    $$;
  `;

  await runCommand("psql", [...psqlBase, "-d", dbName, "-c", sql], {
    cwd: repoRoot,
    env: pgEnv,
  });
};

/* ------------------------------------------------------------------ */
/*  Backend lifecycle                                                  */
/* ------------------------------------------------------------------ */

const startBackend = () => {
  const appUrl = process.env.APP_URL ?? `http://127.0.0.1:${backendPort}`;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV ?? "test",
    SERVER_PORT: String(backendPort),
    DB_HOST: dbHost,
    DB_PORT: dbPort,
    DB_USERNAME: dbUser,
    DB_PASSWORD: dbPass,
    ASSETS_BUCKET: process.env.ASSETS_BUCKET,
    DB_NAME: dbName,
    JWT_SECRET: process.env.JWT_SECRET ?? "dev-jwt-secret",
    JWT_REFRESH_SECRET:
      process.env.JWT_REFRESH_SECRET ?? "dev-jwt-refresh-secret",
    APP_URL: appUrl,
    SMTP_HOST: process.env.SMTP_HOST ?? "localhost",
    SMTP_USER: process.env.SMTP_USER ?? "ci-user",
    SMTP_PASSWORD: process.env.SMTP_PASSWORD ?? "ci-password",
  };

  return spawnProcess("bun", ["dev"], {
    cwd: path.join(repoRoot, "server"),
    env,
  });
};

/* ------------------------------------------------------------------ */
/*  iOS build + simulator                                              */
/* ------------------------------------------------------------------ */

const getMaestroCommand = async () => {
  const configured = process.env.MAESTRO_BIN;
  if (configured) {
    return configured;
  }

  const homeBin = path.join(os.homedir(), ".maestro", "bin", "maestro");
  if (await fileExists(homeBin)) {
    return homeBin;
  }

  return "maestro";
};

type SimDevice = {
  name: string;
  udid: string;
  isAvailable?: boolean;
};

const listAvailableSimulators = async () => {
  const output = await execFileCapture(
    "xcrun",
    ["simctl", "list", "devices", "available", "-j"],
    { cwd: repoRoot, env: process.env },
  );
  const devices = JSON.parse(output) as {
    devices: Record<string, SimDevice[]>;
  };

  return Object.entries(devices.devices)
    .reverse()
    .flatMap(([, runtimeDevices]) => runtimeDevices)
    .filter((device) => device.isAvailable !== false);
};

const findSimulatorUdid = async () => {
  const devices = await listAvailableSimulators();

  for (const preferredName of preferredSimulatorNames) {
    const match = devices.find((device) => device.name === preferredName);
    if (match) {
      return { udid: match.udid, name: match.name };
    }
  }

  const fallback = devices.find((device) => device.name.startsWith("iPhone "));
  if (fallback) {
    return { udid: fallback.udid, name: fallback.name };
  }

  throw new Error(
    `Could not find an available iPhone simulator. Available devices: ${devices
      .map((device) => device.name)
      .join(", ")}`,
  );
};

const bootSimulator = async (udid: string, simulatorName: string) => {
  console.log(`${logPrefix} Booting simulator ${simulatorName} (${udid})...`);
  await tryRunCommand("xcrun", ["simctl", "shutdown", udid], {
    cwd: repoRoot,
    env: process.env,
  });
  await tryRunCommand("xcrun", ["simctl", "erase", udid], {
    cwd: repoRoot,
    env: process.env,
  });
  await tryRunCommand("xcrun", ["simctl", "boot", udid], {
    cwd: repoRoot,
    env: process.env,
  });
  await runCommand("xcrun", ["simctl", "bootstatus", udid, "-b"], {
    cwd: repoRoot,
    env: process.env,
  });
  if (process.env.CI !== "true") {
    await tryRunCommand(
      "open",
      ["-a", "Simulator", "--args", "-CurrentDeviceUDID", udid],
      {
        cwd: repoRoot,
        env: process.env,
      },
    );
  }
  await tryRunCommand("xcrun", ["simctl", "ui", udid, "appearance", "light"], {
    cwd: repoRoot,
    env: process.env,
  });
  await tryRunCommand(
    "xcrun",
    [
      "simctl",
      "status_bar",
      udid,
      "override",
      "--time",
      "9:41",
      "--batteryState",
      "charged",
      "--batteryLevel",
      "100",
      "--wifiBars",
      "3",
      "--cellularBars",
      "4",
    ],
    {
      cwd: repoRoot,
      env: process.env,
    },
  );
};

const buildIosApp = async (udid: string) => {
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

const ensureIosWorkspace = async () => {
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

const installApp = async (udid: string) => {
  console.log(`${logPrefix} Installing iOS app on simulator...`);
  await tryRunCommand("xcrun", ["simctl", "uninstall", udid, bundleId], {
    cwd: repoRoot,
    env: process.env,
  });
  await runCommand("xcrun", ["simctl", "install", udid, appBinaryPath], {
    cwd: repoRoot,
    env: process.env,
  });
};

const launchApp = async (udid: string) => {
  console.log(`${logPrefix} Launching iOS app on simulator...`);
  await runCommand("xcrun", ["simctl", "launch", udid, bundleId], {
    cwd: repoRoot,
    env: process.env,
  });
  await delay(3000);
};

const writeMaestroFlow = async (
  filePath: string,
  deepLink: string,
  readyTestId: string,
  screenshotFileName: string,
) => {
  // NOTE: We pass the stem without a .png extension because Maestro's
  // takeScreenshot auto-appends ".png". The file lands in Maestro's CWD,
  // which we set to outputDir when invoking `maestro test`.
  const contents = `appId: "${bundleId}"
---
- launchApp
- openLink: "${deepLink}"
- extendedWaitUntil:
    visible: "Open in .*Alliance.*"
    timeout: 5000
    optional: true
- tapOn:
    text: "Open"
    optional: true
- extendedWaitUntil:
    visible:
      id: "${readyTestId}"
    timeout: 20000
- assertVisible:
    id: "${readyTestId}"
- waitForAnimationToEnd
- takeScreenshot:
    path: "${screenshotFileName}"
`;
  await fs.writeFile(filePath, contents, "utf8");
};

const captureScreenshots = async (udid: string, simulatorName: string) => {
  if (selectedTargets.length === 0) {
    throw new Error(
      `No mobile screenshot targets matched SCREENSHOT_TARGETS="${process.env.SCREENSHOT_TARGETS ?? ""}"`,
    );
  }

  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(path.dirname(appBinaryPath), { recursive: true });

  console.log(`${logPrefix} Output directory: ${outputDir}`);

  await setupDatabase();
  startBackend();
  await waitForHttp(`http://127.0.0.1:${backendPort}/`, 60000);

  await ensureIosWorkspace();
  await bootSimulator(udid, simulatorName);
  await buildIosApp(udid);
  await installApp(udid);
  await launchApp(udid);

  const maestro = await getMaestroCommand();
  const flowDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "alliance-mobile-maestro-"),
  );

  try {
    for (const [index, target] of selectedTargets.entries()) {
      // Maestro's takeScreenshot auto-appends ".png", so we use a stem
      // without the extension in the YAML flow. The final file on disk
      // will be "<stem>.png".
      const stem = `${String(index + 1).padStart(2, "0")}-${sanitizeFileName(
        target.name,
      )}`;
      const fileName = `${stem}.png`;
      const expectedPath = path.join(outputDir, fileName);
      const flowPath = path.join(flowDir, `${target.name}.yaml`);

      console.log(`${logPrefix} Capturing ${target.deepLink} -> ${fileName}`);

      // Pass the stem (no .png) — Maestro appends the extension itself.
      await writeMaestroFlow(
        flowPath,
        target.deepLink,
        target.readyTestId,
        stem,
      );

      // Maestro writes takeScreenshot output relative to its CWD, so we
      // set cwd to the output directory directly.
      await runCommand(maestro, ["test", "--udid", udid, flowPath], {
        cwd: outputDir,
        env: {
          ...process.env,
          MAESTRO_CLI_NO_ANALYTICS: process.env.MAESTRO_CLI_NO_ANALYTICS ?? "1",
        },
      });

      if (!(await fileExists(expectedPath))) {
        throw new Error(
          `Maestro completed but did not write the expected screenshot at ${expectedPath}`,
        );
      }

      await delay(target.settleMs ?? 800);
    }
  } finally {
    await fs.rm(flowDir, { recursive: true, force: true });
    await tryRunCommand("xcrun", ["simctl", "status_bar", udid, "clear"], {
      cwd: repoRoot,
      env: process.env,
    });
  }
};

/* ------------------------------------------------------------------ */
/*  Entrypoint                                                         */
/* ------------------------------------------------------------------ */

const main = async () => {
  const handleTermination = (signal: NodeJS.Signals) => {
    console.log(`${logPrefix} Received ${signal}. Shutting down...`);
    void shutdown(1);
  };

  process.on("SIGINT", handleTermination);
  process.on("SIGTERM", handleTermination);

  try {
    const simulator = process.env.IOS_SIMULATOR_UDID
      ? {
          udid: process.env.IOS_SIMULATOR_UDID,
          name: process.env.IOS_SIMULATOR_NAME ?? "custom simulator",
        }
      : await findSimulatorUdid();
    await captureScreenshots(simulator.udid, simulator.name);
    await shutdown(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${logPrefix} Failed: ${message}`);
    await shutdown(1);
  }
};

void main();
