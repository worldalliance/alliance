import { milliseconds } from "date-fns";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import process from "process";
import {
  delay,
  execFileCapture,
  runCommand,
  shutdown,
  spawnProcess,
  trackChildProcess,
  waitForHttp,
  type SpawnOptions,
} from "./child-processes";
import { fileExists } from "./file-exists";
import { buildIosApp, ensureIosWorkspace } from "./ios-build";
import {
  appBinaryPath,
  backendPort,
  bundleId,
  dbName,
  logPrefix,
  outputDir,
  preferredSimulatorNames,
  repoRoot,
  selectedTargets,
} from "./mobile-screenshot-config";
import { sanitizeFileName } from "./sanitize-file-name";
import { dbHost, dbPass, dbPort, dbUser, seedDatabase } from "./seed-database";

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
/*  iOS simulator                                                      */
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
  await delay(milliseconds({ seconds: 3 }));
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
    timeout: ${milliseconds({ seconds: 5 })}
    optional: true
- tapOn:
    text: "Open"
    optional: true
- extendedWaitUntil:
    visible:
      id: "${readyTestId}"
    timeout: ${milliseconds({ seconds: 20 })}
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

  await seedDatabase({
    logPrefix,
    onSpawn: trackChildProcess,
  });
  startBackend();
  await waitForHttp(
    `http://127.0.0.1:${backendPort}/`,
    milliseconds({ minutes: 1 }),
  );

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
      const stem = `${String(index + 1).padStart(2, "0")}-${sanitizeFileName(target.name, { fallback: "screen" })}`;
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
