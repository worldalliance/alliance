import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import process from "process";
import { chromium, type Page } from "@playwright/test";
import { screenshotTargets } from "./screenshot-targets";
import { testUserEmail, testUserPassword } from "./test-user";

type ChildProcessHandle = ReturnType<typeof spawn>;

type SpawnOptions = {
  cwd: string;
  env?: NodeJS.ProcessEnv;
};

const repoRoot = path.resolve(__dirname, "..", "..");
const backendPort = Number(process.env.BACKEND_PORT ?? "3005");
const frontendPort = Number(process.env.FRONTEND_PORT ?? "5173");
const frontendMode = (process.env.FRONTEND_MODE ?? "prod").toLowerCase();
const frontendBuildMode = process.env.FRONTEND_BUILD_MODE ?? "development";
const baseUrl = process.env.FRONTEND_URL ?? `http://localhost:${frontendPort}`;
const rawOutputDir =
  process.env.SCREENSHOT_OUTPUT_DIR ??
  path.join(
    repoRoot,
    "citesting",
    "screenshots",
    new Date().toISOString().replace(/[:.]/g, "-")
  );
const outputDir = path.isAbsolute(rawOutputDir)
  ? rawOutputDir
  : path.join(repoRoot, rawOutputDir);

const dbHost = process.env.DB_HOST ?? "localhost";
const dbPort = process.env.DB_PORT ?? "5432";
const dbUser = process.env.DB_USERNAME ?? "postgres";
const dbPass = process.env.DB_PASSWORD ?? "postgres";
const dbName = process.env.DB_NAME ?? "citesting";

const childProcesses: ChildProcessHandle[] = [];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const logPrefix = "[citesting:screenshots]";

const sanitizeFileName = (value: string) =>
  value
    .replace(/^\//, "")
    .replace(/\//g, "-")
    .replace(/[^a-zA-Z0-9-_.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "page";

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
  options: SpawnOptions
) => {
  return trackChildProcess(
    spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      detached: process.platform !== "win32",
      stdio: "inherit",
    })
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
    })
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

const runCommand = (command: string, args: string[], options: SpawnOptions) =>
  new Promise<void>((resolve, reject) => {
    const child = trackChildProcess(
      spawn(command, args, {
        cwd: options.cwd,
        env: options.env,
        stdio: "inherit",
      })
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

const fileExists = async (filePath: string) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

/* ------------------------------------------------------------------ */
/*  Database setup                                                     */
/* ------------------------------------------------------------------ */

const setupDatabase = async () => {
  console.log(`${logPrefix} Setting up database "${dbName}"...`);

  const pgEnv: NodeJS.ProcessEnv = { ...process.env, PGPASSWORD: dbPass };
  const psqlBase = ["-h", dbHost, "-p", dbPort, "-U", dbUser];

  // Drop and recreate the database so every run starts clean.
  await runCommand(
    "psql",
    [
      ...psqlBase,
      "-d",
      "postgres",
      "-c",
      `DROP DATABASE IF EXISTS "${dbName}"`,
    ],
    { cwd: repoRoot, env: pgEnv }
  );
  await runCommand(
    "psql",
    [...psqlBase, "-d", "postgres", "-c", `CREATE DATABASE "${dbName}"`],
    { cwd: repoRoot, env: pgEnv }
  );

  // Run migrations to create the schema from source of truth.
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
    }
  );

  // Load the data-only dump. Using session_replication_role =
  // replica disables FK triggers during the bulk insert so row ordering
  // doesn't matter (handles circular FKs such as comment → comment).
  console.log(`${logPrefix} Loading seed dump...`);
  await loadSeedData(psqlBase, pgEnv);

  // Shift all timestamps forward so relative times ("2 days ago") are
  // stable regardless of when the test runs.  The seed was dumped on
  // SEED_REFERENCE_DATE; we add (NOW() - reference) to every timestamp column.
  console.log(`${logPrefix} Shifting timestamps to current date...`);
  await shiftTimestamps(psqlBase, pgEnv);
};

const loadSeedData = async (psqlBase: string[], pgEnv: NodeJS.ProcessEnv) => {
  const seedFile = path.join(
    repoRoot,
    "citesting",
    "fixtures",
    "seed_dataonly.sql"
  );
  let seedContent = await fs.readFile(seedFile, "utf8");

  // Strip pg17-only constructs so the dump loads on older Postgres versions.
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
      }
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

// Date the seed dump was created — used to compute the time shift.
const SEED_REFERENCE_DATE = "2026-02-10T18:00:00Z";

const shiftTimestamps = async (
  psqlBase: string[],
  pgEnv: NodeJS.ProcessEnv
) => {
  // Dynamically discover every timestamp/timestamptz column in the public
  // schema and shift it forward by (NOW() - SEED_REFERENCE_DATE).  This keeps
  // relative time strings ("2 days ago") stable across runs.
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
/*  Auth                                                               */
/* ------------------------------------------------------------------ */

const loginTestUser = async (page: Page): Promise<void> => {
  console.log(`${logPrefix} Logging in test user (${testUserEmail})...`);

  // Navigate to the frontend so we have a page origin, then perform the
  // login fetch from inside the browser.  This lets the backend's Set-Cookie
  // headers be stored naturally by the browser with the correct domain,
  // path, httpOnly, and sameSite attributes.
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60000 });

  const apiUrl = `http://localhost:${backendPort}`;
  const ok = await page.evaluate(
    async ({ apiUrl, email, password }) => {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, mode: "cookie" }),
        credentials: "include",
      });
      return res.ok;
    },
    { apiUrl, email: testUserEmail, password: testUserPassword }
  );

  if (!ok) {
    throw new Error("Login failed — check test user credentials and seed data");
  }
};

/* ------------------------------------------------------------------ */
/*  Server lifecycle                                                   */
/* ------------------------------------------------------------------ */

const startBackend = () => {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: process.env.NODE_ENV ?? "test",
    DB_HOST: dbHost,
    DB_PORT: dbPort,
    DB_USERNAME: dbUser,
    DB_PASSWORD: dbPass,
    ASSETS_BUCKET: process.env.ASSETS_BUCKET,
    DB_NAME: dbName,
    JWT_SECRET: process.env.JWT_SECRET ?? "dev-jwt-secret",
    JWT_REFRESH_SECRET:
      process.env.JWT_REFRESH_SECRET ?? "dev-jwt-refresh-secret",
    APP_URL: process.env.APP_URL ?? baseUrl,
    SMTP_HOST: process.env.SMTP_HOST ?? "localhost",
    SMTP_USER: process.env.SMTP_USER ?? "ci-user",
    SMTP_PASSWORD: process.env.SMTP_PASSWORD ?? "ci-password",
  };

  return spawnProcess("bun", ["dev"], {
    cwd: path.join(repoRoot, "server"),
    env,
  });
};

const ensureFrontendBuild = async () => {
  const buildEntry = path.join(
    repoRoot,
    "apps",
    "frontend",
    "build",
    "server",
    "index.js"
  );

  if (process.env.FRONTEND_BUILD === "false") {
    return;
  }

  if (process.env.FRONTEND_BUILD !== "true" && (await fileExists(buildEntry))) {
    return;
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    VITE_API_URL: process.env.VITE_API_URL ?? `http://localhost:${backendPort}`,
    VITE_APP_GIT_SHA: process.env.VITE_APP_GIT_SHA ?? "local",
    VITE_APP_VERSION: process.env.VITE_APP_VERSION ?? "local",
  };

  console.log(`${logPrefix} Building frontend (mode: ${frontendBuildMode})...`);
  await runCommand(
    "yarn",
    ["workspace", "@alliance/frontend", "build", "--mode", frontendBuildMode],
    { cwd: repoRoot, env }
  );
};

const startFrontend = async () => {
  if (frontendMode === "prod") {
    await ensureFrontendBuild();
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(frontendPort),
    };
    return spawnProcess("node", ["server.js"], {
      cwd: path.join(repoRoot, "apps", "frontend"),
      env,
    });
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "development",
    CHOKIDAR_USEPOLLING: process.env.CHOKIDAR_USEPOLLING ?? "1",
    CHOKIDAR_INTERVAL: process.env.CHOKIDAR_INTERVAL ?? "2000",
  };

  return spawnProcess(
    "yarn",
    ["workspace", "@alliance/frontend", "dev", "--port", String(frontendPort)],
    {
      cwd: repoRoot,
      env,
    }
  );
};

/* ------------------------------------------------------------------ */
/*  Screenshot capture                                                 */
/* ------------------------------------------------------------------ */

const takeScreenshots = async () => {
  await fs.mkdir(outputDir, { recursive: true });
  console.log(`${logPrefix} Output directory: ${outputDir}`);

  await setupDatabase();

  startBackend();
  await startFrontend();

  await waitForHttp(`http://localhost:${backendPort}/`, 60000);
  await waitForHttp(baseUrl, 90000);

  const hasAuthTargets = screenshotTargets.some((t) => t.requiresAuth);

  const browser = await chromium.launch({ headless: true });

  const contextOptions = {
    viewport: { width: 1440, height: 900 },
    colorScheme: "light" as const,
    reducedMotion: "reduce" as const,
  };

  // Create separate contexts for public and authenticated targets.
  const publicContext = await browser.newContext(contextOptions);
  let authContext: Awaited<ReturnType<typeof browser.newContext>> | null = null;
  if (hasAuthTargets) {
    authContext = await browser.newContext(contextOptions);
    const authLoginPage = await authContext.newPage();
    await loginTestUser(authLoginPage);
    await authLoginPage.close();
  }

  // Capture screenshots in parallel batches for speed.
  const CONCURRENCY = 4;
  for (let i = 0; i < screenshotTargets.length; i += CONCURRENCY) {
    const batch = screenshotTargets.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (target, batchIdx) => {
        const index = i + batchIdx;
        const context = target.requiresAuth ? authContext! : publicContext;
        const page = await context.newPage();

        try {
          const url = new URL(target.path, baseUrl).toString();
          const label = target.name || target.path;
          const fileName = `${String(index + 1).padStart(
            2,
            "0"
          )}-${sanitizeFileName(label)}.png`;
          const filePath = path.join(outputDir, fileName);

          console.log(`${logPrefix} Capturing ${url} -> ${fileName}`);
          await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 60000,
          });
          if (target.waitForSelector) {
            await page.waitForSelector(target.waitForSelector, {
              timeout: target.waitForTimeoutMs ?? 20000,
            });
          } else {
            await page
              .waitForLoadState("networkidle", { timeout: 20000 })
              .catch(() => {
                // Some pages keep background requests open; ignore.
              });
          }
          await page.waitForTimeout(100);
          await page.screenshot({ path: filePath, fullPage: true });
        } finally {
          await page.close();
        }
      })
    );
  }

  await publicContext.close();
  if (authContext) {
    await authContext.close();
  }
  await browser.close();
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
    await takeScreenshots();
    await shutdown(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${logPrefix} Failed: ${message}`);
    await shutdown(1);
  }
};

void main();
