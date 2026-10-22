import { chromium } from "@playwright/test";
import { spawn, spawnSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import path from "path";
import { BASE_PORTS, DevService } from "../../common/src/dev-ports-base";

enum Service {
  Server = "server",
  Frontend = "frontend",
  Admin = "admin",
  MobileWeb = "mobile-web",
  Mobile = "mobile",
}

enum Warmup {
  None,
  Browser,
  Emulator,
}

type Spec = { port: number; command: string[]; warmup: Warmup };

const SPECS: Record<Service, Spec> = {
  [Service.Server]: {
    port: BASE_PORTS[DevService.Server],
    // `dev` runs bun --watch, which survives a boot crash waiting for an edit, so up would wait out its timeout.
    command: ["bun", "run", "--cwd", "server", "start:prod"],
    warmup: Warmup.None,
  },
  [Service.Frontend]: {
    port: BASE_PORTS[DevService.Frontend],
    command: ["bun", "run", "--cwd", "apps/frontend", "dev"],
    warmup: Warmup.Browser,
  },
  [Service.Admin]: {
    port: BASE_PORTS[DevService.Admin],
    command: ["bun", "run", "--cwd", "apps/admin", "dev"],
    warmup: Warmup.Browser,
  },
  [Service.MobileWeb]: {
    port: BASE_PORTS[DevService.Mobile],
    command: ["bun", "run", "--cwd", "apps/mobile", "web"],
    warmup: Warmup.Browser,
  },
  [Service.Mobile]: {
    port: BASE_PORTS[DevService.Mobile],
    command: ["bun", "run", "--cwd", "apps/mobile", "start"],
    warmup: Warmup.Emulator,
  },
};

const APP_ID = "com.alliance.alliancemobile.dev";
const READY_TIMEOUT_MS = 8 * 60_000;
const repoRoot = path.join(import.meta.dir, "../..");
const runDir = path.join(import.meta.dir, "run");
const logPath = (service: Service) => path.join(runDir, `${service}.log`);
const pidPath = (service: Service) => path.join(runDir, `${service}.pid`);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function listeners(port: number): number[] {
  const lsof = spawnSync("lsof", ["-t", `-iTCP:${port}`, "-sTCP:LISTEN"], {
    encoding: "utf8",
  });
  return lsof.stdout.split("\n").filter(Boolean).map(Number);
}

function signal(pid: number, sig: NodeJS.Signals) {
  try {
    process.kill(pid, sig);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ESRCH"))
      throw error;
  }
}

async function stopAll() {
  for (const service of Object.values(Service)) {
    if (!existsSync(pidPath(service))) continue;
    signal(-Number(readFileSync(pidPath(service), "utf8")), "SIGTERM");
    rmSync(pidPath(service));
  }
  const ports = [...new Set(Object.values(SPECS).map((spec) => spec.port))];
  for (let attempt = 0; attempt < 30; attempt++) {
    const pids = ports.flatMap(listeners);
    if (pids.length === 0) return;
    for (const pid of pids) signal(pid, attempt < 10 ? "SIGTERM" : "SIGKILL");
    await sleep(500);
  }
  throw new Error(
    `ports still in use: ${ports.filter((port) => listeners(port).length > 0).join(", ")}`,
  );
}

function tail(service: Service): string {
  return readFileSync(logPath(service), "utf8")
    .split("\n")
    .slice(-30)
    .join("\n");
}

async function waitFor({
  service,
  deadline,
  exited,
  ready,
}: {
  service: Service;
  deadline: number;
  exited: () => boolean;
  ready: () => Promise<boolean>;
}) {
  while (Date.now() < deadline) {
    if (exited())
      throw new Error(
        `${service} exited before it was ready:\n${tail(service)}`,
      );
    if (await ready()) return;
    await sleep(1000);
  }
  throw new Error(
    `${service} not ready after ${READY_TIMEOUT_MS / 1000}s:\n${tail(service)}`,
  );
}

async function answers(url: string): Promise<boolean> {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
}

function adb(...args: string[]) {
  const result = spawnSync("adb", args, { encoding: "utf8" });
  if (result.status !== 0)
    throw new Error(`adb ${args.join(" ")} failed: ${result.stderr}`);
}

async function start(service: Service) {
  const { port, command, warmup } = SPECS[service];
  const started = Date.now();
  const deadline = started + READY_TIMEOUT_MS;
  const log = openSync(logPath(service), "w");
  const child = spawn(command[0], command.slice(1), {
    cwd: repoRoot,
    detached: true,
    stdio: ["ignore", log, log],
  });
  writeFileSync(pidPath(service), String(child.pid));
  let exited = false;
  child.on("exit", () => (exited = true));
  child.unref();

  const url = `http://localhost:${port}`;
  await waitFor({
    service,
    deadline,
    exited: () => exited,
    ready: () => answers(url),
  });

  switch (warmup) {
    case Warmup.None:
      break;
    case Warmup.Browser: {
      const browser = await chromium.launch();
      try {
        const page = await browser.newPage();
        const response = await page.goto(url, {
          waitUntil: "networkidle",
          timeout: Math.max(1, deadline - Date.now()),
        });
        if (!response?.ok())
          throw new Error(
            `${service} answered ${response?.status()} on its first page:\n${tail(service)}`,
          );
      } finally {
        await browser.close();
      }
      break;
    }
    case Warmup.Emulator: {
      adb("reverse", `tcp:${port}`, `tcp:${port}`);
      adb(
        "reverse",
        `tcp:${SPECS[Service.Server].port}`,
        `tcp:${SPECS[Service.Server].port}`,
      );
      adb("shell", "am", "force-stop", APP_ID);
      adb(
        "shell",
        "am",
        "start",
        "-a",
        "android.intent.action.VIEW",
        "-d",
        `exp+alliance-mobile://expo-development-client/?url=${encodeURIComponent(url)}`,
        APP_ID,
      );
      await waitFor({
        service,
        deadline,
        exited: () => exited,
        ready: async () => {
          const log = readFileSync(logPath(service), "utf8");
          if (/Android Bundling failed/.test(log))
            throw new Error(`the app's bundle failed:\n${tail(service)}`);
          return /Android Bundled/.test(log);
        },
      });
      break;
    }
    default:
      throw new Error(`unknown warmup: ${warmup satisfies never}`);
  }
  console.log(
    `${service} ready at ${url} in ${Math.round((Date.now() - started) / 1000)}s, log ${logPath(service)}`,
  );
}

const usage = `usage: bun servers.ts up <${Object.values(Service).join("|")}>... | down`;
const [command, ...names] = process.argv.slice(2);
const services = names.map((name) => {
  const service = Object.values(Service).find((value) => value === name);
  if (!service) throw new Error(`unknown service ${name}\n${usage}`);
  return service;
});

mkdirSync(runDir, { recursive: true });
if (command === "down" && services.length === 0) {
  await stopAll();
} else if (command === "up" && services.length > 0) {
  const ports = services.map((service) => SPECS[service].port);
  if (new Set(ports).size !== ports.length)
    throw new Error("two of those services share a port");
  await stopAll();
  await Promise.all(services.map(start));
} else {
  console.error(usage);
  process.exit(2);
}
