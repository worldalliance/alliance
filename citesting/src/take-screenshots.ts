import { chromium, type Page } from "@playwright/test";
import { milliseconds } from "date-fns";
import { promises as fs } from "fs";
import path from "path";
import process from "process";
import { devPorts, PortCaller } from "../../common/src/dev-ports";
import {
  runCommand,
  shutdown,
  spawnProcess,
  trackChildProcess,
  waitForHttp,
} from "./child-processes";
import { fileExists } from "./file-exists";
import { sanitizeFileName } from "./sanitize-file-name";
import { screenshotDatabase } from "./screenshot-database";
import { screenshotTargets } from "./screenshot-targets";
import { dbHost, dbPass, dbPort, dbUser, seedDatabase } from "./seed-database";
import { testUserEmail, testUserPassword } from "./test-user";

const repoRoot = path.resolve(__dirname, "..", "..");

const ports = devPorts(PortCaller.Tooling);
const backendPort = ports.server;
const frontendPort = ports.frontend;
const frontendMode = (process.env.FRONTEND_MODE ?? "prod").toLowerCase();
const frontendBuildMode = process.env.FRONTEND_BUILD_MODE ?? "development";
const baseUrl = process.env.FRONTEND_URL ?? `http://localhost:${frontendPort}`;

const stackPortEnv: NodeJS.ProcessEnv = {
  SERVER_PORT: String(backendPort),
  FRONTEND_PORT: String(frontendPort),
};
const rawOutputDir =
  process.env.SCREENSHOT_OUTPUT_DIR ??
  path.join(
    repoRoot,
    "citesting",
    "screenshots",
    new Date().toISOString().replace(/[:.]/g, "-"),
  );
const outputDir = path.isAbsolute(rawOutputDir)
  ? rawOutputDir
  : path.join(repoRoot, rawOutputDir);

const dbName = screenshotDatabase();

const logPrefix = "[citesting:screenshots]";

/* ------------------------------------------------------------------ */
/*  Auth                                                               */
/* ------------------------------------------------------------------ */

const loginTestUser = async (page: Page): Promise<void> => {
  console.log(`${logPrefix} Logging in test user (${testUserEmail})...`);

  // Navigate to the frontend so we have a page origin, then perform the
  // login fetch from inside the browser.  This lets the backend's Set-Cookie
  // headers be stored naturally by the browser with the correct domain,
  // path, httpOnly, and sameSite attributes.
  await page.goto(baseUrl, {
    waitUntil: "domcontentloaded",
    timeout: milliseconds({ minutes: 1 }),
  });

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
    { apiUrl, email: testUserEmail, password: testUserPassword },
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
    ...stackPortEnv,
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

const frontendBuildEntry = path.join(
  repoRoot,
  "apps",
  "frontend",
  "build",
  "server",
  "index.js",
);

const ensureFrontendBuild = async () => {
  if (process.env.FRONTEND_BUILD === "false") {
    return;
  }

  if (
    process.env.FRONTEND_BUILD !== "true" &&
    (await fileExists(frontendBuildEntry))
  ) {
    return;
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...stackPortEnv,
    VITE_API_URL: process.env.VITE_API_URL ?? `http://localhost:${backendPort}`,
    VITE_APP_GIT_SHA: process.env.VITE_APP_GIT_SHA ?? "local",
    VITE_APP_VERSION: process.env.VITE_APP_VERSION ?? "local",
  };

  console.log(`${logPrefix} Building frontend (mode: ${frontendBuildMode})...`);
  await runCommand(
    "bun",
    [
      "run",
      "--cwd",
      "apps/frontend",
      "build",
      "--",
      "--mode",
      frontendBuildMode,
    ],
    { cwd: repoRoot, env },
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
    ...stackPortEnv,
    NODE_ENV: "development",
    CHOKIDAR_USEPOLLING: process.env.CHOKIDAR_USEPOLLING ?? "1",
    CHOKIDAR_INTERVAL: process.env.CHOKIDAR_INTERVAL ?? "2000",
  };

  return spawnProcess(
    "bun",
    [
      "run",
      "--cwd",
      "apps/frontend",
      "dev",
      "--",
      "--port",
      String(frontendPort),
    ],
    {
      cwd: repoRoot,
      env,
    },
  );
};

/* ------------------------------------------------------------------ */
/*  Screenshot capture                                                 */
/* ------------------------------------------------------------------ */

// fullPage capture never scrolls, so images below the fold stay outside the
// lazy-loading threshold and would be captured blank.
const settleImages = async (page: Page) => {
  await page.evaluate(() => {
    for (const img of document.querySelectorAll<HTMLImageElement>(
      'img[loading="lazy"]',
    )) {
      img.loading = "eager";
    }
  });

  try {
    await page.waitForFunction(
      () => Array.from(document.images).every((img) => img.complete),
      undefined,
      { timeout: milliseconds({ seconds: 30 }) },
    );
  } catch {
    const pending = await page.evaluate(() =>
      Array.from(document.images)
        .filter((img) => !img.complete)
        .map((img) => img.currentSrc || img.src),
    );
    throw new Error(
      `${page.url()} still had images loading after 30s: ${pending.join(", ")}`,
    );
  }
};

const takeScreenshots = async () => {
  await fs.mkdir(outputDir, { recursive: true });
  console.log(`${logPrefix} Output directory: ${outputDir}`);

  await seedDatabase({
    logPrefix,
    onSpawn: trackChildProcess,
  });

  startBackend();
  await startFrontend();

  await waitForHttp(
    `http://localhost:${backendPort}/`,
    milliseconds({ minutes: 1 }),
  );
  await waitForHttp(baseUrl, milliseconds({ seconds: 90 }));

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
            "0",
          )}-${sanitizeFileName(label, { fallback: "page" })}.png`;
          const filePath = path.join(outputDir, fileName);

          console.log(`${logPrefix} Capturing ${url} -> ${fileName}`);
          await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: milliseconds({ minutes: 1 }),
          });
          if (target.waitForSelector) {
            await page.waitForSelector(target.waitForSelector, {
              timeout: target.waitForTimeoutMs ?? milliseconds({ seconds: 20 }),
            });
          } else {
            await page
              .waitForLoadState("networkidle", {
                timeout: milliseconds({ seconds: 20 }),
              })
              .catch(() => {
                // Some pages keep background requests open; ignore.
              });
          }
          await settleImages(page);
          await page.waitForTimeout(100);
          await page.screenshot({ path: filePath, fullPage: true });
        } finally {
          await page.close();
        }
      }),
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
