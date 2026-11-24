import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { testSourceVariable } from "../src/main/repository/source";
import { AgentKind } from "../src/shared/agent-kind";
import type { AgentApi } from "../src/shared/ipc";
import {
  authStatusCapture,
  claudeExecutableVariable,
  launch,
  writeClaude,
} from "./launch";

declare const window: { agent: AgentApi };

/** This test's login shell: runs body, then hands its arguments to profile-free-shell. */
function writeShell(body: string): string {
  const shell = test.info().outputPath("shell");
  writeFileSync(
    shell,
    `#!/bin/sh\n${body}\nexec '${path.join(import.meta.dirname, "profile-free-shell")}' "$@"\n`,
  );
  chmodSync(shell, 0o755);
  return shell;
}

/** Launches with shell as the login shell and checks sign-in at once, returning the PATH, ALLIANCE_TEST_PROFILE and ALLIANCE_AGENT_DEV_SCRIPT the CLI ran with, and the app's stderr. Before the check returns, waitForShell runs, given whether the CLI has started. */
async function claudeEnvironment(params: {
  shell: string;
  env?: Record<string, string>;
  waitForShell?: (started: () => boolean) => Promise<void>;
}) {
  const seen = test.info().outputPath("seen");
  const claude = writeClaude(
    `printf '%s\\n' "$ALLIANCE_TEST_PROFILE" "$PATH" "$ALLIANCE_AGENT_DEV_SCRIPT" > "${seen}"\nexec "${process.env[claudeExecutableVariable]}" "$@"\n`,
  );
  // The test source skips launch's wait for the repository check, which itself waits for the shell.
  const { app, page } = await launch({
    captures: [authStatusCapture(true)],
    claude,
    env: {
      SHELL: params.shell,
      [testSourceVariable]: process.env[testSourceVariable] ?? "",
      ...params.env,
    },
  });
  let stderr = "";
  app.process().stderr?.on("data", (chunk: Buffer) => (stderr += chunk));
  const signedIn = page.evaluate(
    (agent) => window.agent.signedIn(agent),
    AgentKind.Claude,
  );
  await params.waitForShell?.(() => existsSync(seen));
  expect(await signedIn).toEqual({ ok: true, value: true });
  await app.close();
  const [profile, PATH, devScript] = readFileSync(seen, "utf8").split("\n");
  return { profile, PATH, devScript, stderr };
}

test("an agent's CLI waits for the login shell and runs with the environment its profile sets", async () => {
  const release = test.info().outputPath("release-shell");
  const seen = await claudeEnvironment({
    shell: writeShell(
      `while [ ! -e "${release}" ]; do sleep 0.1; done\nexport ALLIANCE_TEST_PROFILE=loaded PATH="/profile/bin:$PATH"`,
    ),
    waitForShell: async (started) => {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      expect(started()).toBe(false);
      writeFileSync(release, "");
    },
  });
  expect(seen.profile).toBe("loaded");
  expect(seen.PATH).toContain("/profile/bin:");
});

test("when the login shell fails, the app reports it and an agent's CLI still runs, with the PATH the app started with", async () => {
  const release = test.info().outputPath("release-shell");
  const shell = writeShell(
    `while [ ! -e "${release}" ]; do sleep 0.1; done\nexit 1`,
  );
  const seen = await claudeEnvironment({
    shell,
    // Released only once the test is reading stderr, so the report can't print unseen.
    waitForShell: () => Promise.resolve(writeFileSync(release, "")),
  });
  expect(seen.profile).toBe("");
  expect(seen.PATH?.endsWith(process.env.PATH ?? "")).toBe(true);
  expect(seen.stderr).toContain(
    `Alliance agent couldn't load your shell environment: ${shell} exited with code 1 before printing its environment.`,
  );
});

test("quitting while the login shell hangs stops it and what its profile started", async () => {
  const pids = test.info().outputPath("pids");
  const { app } = await launch({
    captures: [],
    env: {
      SHELL: writeShell(`sleep 600 &\necho $$ $! > "${pids}"\nwait`),
      [testSourceVariable]: process.env[testSourceVariable] ?? "",
    },
  });
  await expect.poll(() => existsSync(pids)).toBe(true);
  await app.close();
  const alive = (pid: string) => {
    try {
      process.kill(Number(pid), 0);
      return true;
    } catch {
      return false;
    }
  };
  await expect
    .poll(() => readFileSync(pids, "utf8").trim().split(" ").filter(alive))
    .toEqual([]);
});

test("launched by bun run dev, the app skips the login shell and an agent's CLI runs with the environment the app started with, behind the launchers", async () => {
  const seen = await claudeEnvironment({
    shell: writeShell("export ALLIANCE_TEST_PROFILE=loaded"),
    env: { ALLIANCE_AGENT_DEV_SCRIPT: "1" },
  });
  expect(seen.profile).toBe("");
  expect(seen.PATH?.endsWith(process.env.PATH ?? "")).toBe(true);
  const first = seen.PATH?.split(path.delimiter)[0] ?? "";
  expect(path.basename(first)).toBe("bin");
  expect(existsSync(path.join(first, "claude"))).toBe(true);
  expect(seen.devScript).toBe("");
});

test("git waits for the login shell, and git and Bun run from the PATH its profile sets", async () => {
  const bin = test.info().outputPath("profile-bin");
  const ran = test.info().outputPath("ran");
  mkdirSync(bin);
  for (const tool of ["git", "bun"]) {
    const real = execFileSync("/bin/sh", ["-c", `command -v ${tool}`], {
      encoding: "utf8",
    }).trim();
    writeFileSync(
      path.join(bin, tool),
      `#!/bin/sh\necho ${tool} >> "${ran}"\nexec "${real}" "$@"\n`,
    );
    chmodSync(path.join(bin, tool), 0o755);
  }
  // The wrappers are on the profile's PATH alone, so a lookup made before the load finds the real tools and records nothing.
  const { app } = await launch({
    captures: [],
    env: { SHELL: writeShell(`sleep 1\nexport PATH="${bin}:$PATH"`) },
  });
  // The repository check runs git at launch, and the worktree listing that follows it runs Bun, so Bun's own wait goes untested.
  await expect
    .poll(() =>
      existsSync(ran)
        ? new Set(readFileSync(ran, "utf8").trim().split("\n"))
        : new Set(),
    )
    .toEqual(new Set(["git", "bun"]));
  await app.close();
});

test("a sign-in asked for while the login shell loads doesn't run the CLI once the quit begins", async () => {
  const ran = test.info().outputPath("ran");
  const { app, page } = await launch({
    captures: [],
    claude: writeClaude(`touch "${ran}"\n`),
    env: {
      SHELL: writeShell("sleep 600"),
      [testSourceVariable]: process.env[testSourceVariable] ?? "",
    },
  });
  // The app exits before its reply reaches the closing page.
  void page
    .evaluate((agent) => window.agent.signIn(agent), AgentKind.Claude)
    .catch(() => undefined);
  // Lets the request reach the main process, which then waits for the shell.
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  const closed = app.waitForEvent("close");
  await app.evaluate(({ app }) => app.quit());
  await closed;
  // A CLI started as the app exits outlives it.
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  expect(existsSync(ran)).toBe(false);
});
