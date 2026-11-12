import { expect, type Page, test } from "@playwright/test";
import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { claudeExecutableVariable } from "../src/main/claude-executable";
import { AgentEventKind } from "../src/shared/agent-event";
import { type AgentApi } from "../src/shared/ipc";
import { appArgs } from "./app-args";
import { firstMessage, start } from "./ipc-helpers";
import {
  captured,
  launch,
  noteOutlivedApp,
  outlivedApp,
  runningCount,
  trackedClaude,
  workFolder,
} from "./launch";

// page.evaluate callbacks run in the renderer, where the preload defines window.agent.
declare const window: { agent: AgentApi };

const quitting = { ok: false, error: "Alliance agent is quitting." };

const savedConversation = () => ({
  id: "77407954-2715-4b2e-a1ec-dda348dd27fd",
  folder: workFolder(),
  title: "Resumable",
  startedAt: "2026-11-10T12:00:00.000Z",
});

/** Replaces the saved conversation list with a FIFO after the renderer's own read of it as it mounts, so the next read waits until the test writes the list. */
async function holdNextListRead(page: Page): Promise<() => Promise<number>> {
  await expect(page.locator("#root main")).toBeAttached();
  await page.evaluate(() => window.agent.listConversations());
  const list = test.info().outputPath("user-data", "conversations.json");
  rmSync(list, { force: true });
  execFileSync("mkfifo", [list]);
  // Opening the FIFO without blocking fails until a read has it open.
  const openFifo = () => {
    try {
      return openSync(list, constants.O_WRONLY | constants.O_NONBLOCK);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENXIO")
        return undefined;
      throw error;
    }
  };
  return async () => {
    let fifo = openFifo();
    while (fifo === undefined) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      fifo = openFifo();
    }
    return fifo;
  };
}

/** Resolves when any turn ends; call it before the call that starts the turn. */
function nextTurnEnd(page: Page): Promise<void> {
  return page.evaluate(
    (turnEnded) =>
      new Promise<void>((resolve) => {
        window.agent.onEvent(({ event }) => {
          if (event.kind === turnEnded) resolve();
        });
      }),
    AgentEventKind.TurnEnded,
  );
}

test("quitting waits for every conversation's CLI to exit", async () => {
  const claude = trackedClaude();
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
    claude,
  });
  await start(page);
  expect(runningCount(claude)).toBe(1);
  await app.close();
  expect(runningCount(claude)).toBe(0);
  expect(outlivedApp(claude)).toBe(false);
});

test("quitting twice still waits for every conversation's CLI", async () => {
  const claude = trackedClaude();
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
    claude,
  });
  await start(page);
  const closed = app.waitForEvent("close");
  await app.evaluate(({ app }) => {
    app.quit();
    app.quit();
  });
  await closed;
  expect(runningCount(claude)).toBe(0);
  expect(outlivedApp(claude)).toBe(false);
});

test("quitting while a conversation starts waits for its CLI too", async () => {
  const claude = trackedClaude();
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
    claude,
  });
  await page.evaluate((input) => void window.agent.start(input), {
    folder: workFolder(),
    firstMessage,
  });
  await expect.poll(() => runningCount(claude)).toBeGreaterThan(0);
  await app.close();
  expect(runningCount(claude)).toBe(0);
  expect(outlivedApp(claude)).toBe(false);
});

test("quitting waits only so long for a conversation still starting", async () => {
  const claude = test.info().outputPath("claude");
  writeFileSync(
    claude,
    `#!/bin/sh\nsleep 5\nexec "${process.env[claudeExecutableVariable]}" "$@"\n`,
  );
  chmodSync(claude, 0o755);
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
    claude,
    env: { ALLIANCE_AGENT_OPENING_WAIT_MS: "500" },
  });
  await page.evaluate((input) => void window.agent.start(input), {
    folder: workFolder(),
    firstMessage,
  });
  await expect.poll(() => runningCount(claude)).toBeGreaterThan(0);
  const quitAt = Date.now();
  await app.close();
  expect(Date.now() - quitAt).toBeLessThan(3_000);
  await expect.poll(() => runningCount(claude), { timeout: 10_000 }).toBe(0);
});

test("quitting waits only so long for a new conversation's first reply", async () => {
  const claude = test.info().outputPath("claude");
  writeFileSync(
    claude,
    `#!/bin/sh
case "$1" in
  --version|auth) exec "${process.env[claudeExecutableVariable]}" "$@";;
esac
trap 'kill $!; exit 143' TERM
sleep 30 & wait $!
`,
  );
  chmodSync(claude, 0o755);
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
    claude,
    env: { ALLIANCE_AGENT_OPENING_WAIT_MS: "500" },
  });
  const started = await page.evaluate(
    (input) => window.agent.start(input).then((result) => result.ok),
    { folder: workFolder(), firstMessage },
  );
  expect(started).toBe(true);
  const quitAt = Date.now();
  await app.close();
  expect(Date.now() - quitAt).toBeLessThan(3_000);
  expect(runningCount(claude)).toBe(0);
});

test("quitting closes live conversations without waiting for one still starting", async () => {
  const claude = test.info().outputPath("claude");
  const stub = process.env[claudeExecutableVariable];
  const exited = test.info().outputPath("session-exited");
  writeFileSync(
    claude,
    `#!/bin/sh
case "$1" in
  --version) mkdir "${test.info().outputPath("checked")}" 2>/dev/null || sleep 8; exec "${stub}" "$@";;
  auth) exec "${stub}" "$@";;
esac
"${stub}" "$@"
status=$?
touch "${exited}"
exit $status
`,
  );
  chmodSync(claude, 0o755);
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
    claude,
  });
  const firstTurnEnded = nextTurnEnd(page);
  await page.evaluate(
    (input) =>
      void Promise.all([window.agent.start(input), window.agent.start(input)]),
    { folder: workFolder(), firstMessage },
  );
  await firstTurnEnded;
  const closed = app.waitForEvent("close");
  await app.evaluate(({ app }) => app.quit());
  await expect.poll(() => existsSync(exited), { timeout: 3_000 }).toBe(true);
  await closed;
});

test("a conversation or resume that finishes starting while the quit closes others is closed too", async () => {
  const claude = test.info().outputPath("claude");
  const stub = process.env[claudeExecutableVariable];
  const userData = test.info().outputPath("user-data");
  const gates = test.info().outputPath("gates");
  mkdirSync(gates, { recursive: true });
  const resumable = savedConversation();
  mkdirSync(userData, { recursive: true });
  writeFileSync(
    path.join(userData, "conversations.json"),
    JSON.stringify({ version: 1, conversations: [resumable] }),
  );
  // Version check n waits for release-n; session n, once its CLI ends, notes stopped-n and waits for exit-n, each numbered in arrival order.
  writeFileSync(
    claude,
    `#!/bin/sh
wait_for() { while [ ! -e "${gates}/$1" ]; do sleep 0.05; done; }
take() { n=1; while ! mkdir "${gates}/$1-$n" 2>/dev/null; do n=$((n+1)); done; }
case "$1" in
  --version) take check; wait_for "release-$n"; exec "${stub}" "$@";;
  auth) exec "${stub}" "$@";;
esac
take session
"${stub}" "$@"
status=$?
touch "${gates}/stopped-$n"
wait_for "exit-$n"
touch "${gates}/leaving-$n"
${noteOutlivedApp(claude)}
exit $status
`,
  );
  chmodSync(claude, 0o755);
  const gate = (name: string) => path.join(gates, name);
  const open = (name: string) => writeFileSync(gate(name), "");
  const reached = (name: string) =>
    expect.poll(() => existsSync(gate(name)), { timeout: 10_000 }).toBe(true);
  // A guess at when the quit's next pass has taken its snapshot: too short lets the test pass without that pass, never fail it.
  const exited = async (n: number) => {
    await reached(`leaving-${n}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  };
  const { app, page } = await launch({
    captures: [
      captured("edit-and-interrupt-session"),
      captured("resume-with-image-session"),
    ],
    claude,
    env: { ALLIANCE_AGENT_OPENING_WAIT_MS: "500" },
  });
  const firstTurnEnded = nextTurnEnd(page);
  const input = { folder: workFolder(), firstMessage };
  const first = page.evaluate((input) => window.agent.start(input), input);
  await reached("check-1");
  // Both enter the version check before the first start's check passes, so neither skips it.
  const late = page.evaluate(
    ({ input, id }) =>
      Promise.all([window.agent.start(input), window.agent.resume(id)]),
    { input, id: resumable.id },
  );
  await reached("check-2");
  await reached("check-3");
  open("release-1");
  await firstTurnEnded;
  const closed = app.waitForEvent("close");
  await app.evaluate(({ app }) => app.quit());
  await reached("stopped-1");
  open("release-2");
  await reached("stopped-2");
  open("exit-1");
  await exited(1);
  open("release-3");
  await reached("stopped-3");
  open("exit-2");
  await exited(2);
  open("exit-3");
  const started = await first;
  expect(started.ok).toBe(true);
  expect(await late).toEqual([quitting, quitting]);
  await closed;
  expect(runningCount(claude)).toBe(0);
  expect(outlivedApp(claude)).toBe(false);
  const saved = JSON.parse(
    readFileSync(path.join(userData, "conversations.json"), "utf8"),
  );
  expect(saved.conversations.map((c: { id: string }) => c.id)).toEqual([
    ...(started.ok ? [started.value.id] : []),
    resumable.id,
  ]);
});

/** A CLI that boots slowly, noting when it is stopped before it has read its first message and when it outlives the app. */
function slowBootClaude(): { claude: string; cutBeforeBoot: string } {
  const claude = test.info().outputPath("claude");
  const stub = process.env[claudeExecutableVariable];
  const cutBeforeBoot = test.info().outputPath("cut-before-boot");
  writeFileSync(
    claude,
    `#!/bin/sh
case "$1" in
  --version|auth) exec "${stub}" "$@";;
esac
trap 'touch "${cutBeforeBoot}"; exit 143' TERM
sleep 3 & wait $!
trap - TERM
"${stub}" "$@"
status=$?
sleep 1
${noteOutlivedApp(claude)}
exit $status
`,
  );
  chmodSync(claude, 0o755);
  return { claude, cutBeforeBoot };
}

test("a conversation started just before the quit gets a reply before it closes", async () => {
  const { claude, cutBeforeBoot } = slowBootClaude();
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
    claude,
  });
  const started = await page.evaluate(
    (input) => window.agent.start(input).then((result) => result.ok),
    { folder: workFolder(), firstMessage },
  );
  expect(started).toBe(true);
  await app.close();
  expect(existsSync(cutBeforeBoot)).toBe(false);
});

test("a conversation still saving when the quit begins gets a reply before it closes", async () => {
  const { claude, cutBeforeBoot } = slowBootClaude();
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
    claude,
  });
  // Start's save reads the list first.
  const listRead = await holdNextListRead(page);
  const started = page.evaluate(
    (input) => window.agent.start(input).then((result) => result.ok),
    { folder: workFolder(), firstMessage },
  );
  const fifo = await listRead();
  const closed = app.waitForEvent("close");
  await app.evaluate(({ app }) => app.quit());
  writeFileSync(fifo, JSON.stringify({ version: 1, conversations: [] }));
  closeSync(fifo);
  expect(await started).toBe(true);
  await closed;
  expect(existsSync(cutBeforeBoot)).toBe(false);
  expect(runningCount(claude)).toBe(0);
  expect(outlivedApp(claude)).toBe(false);
});

test("a resume still reading the saved conversations when the quit begins launches no CLI", async () => {
  const claude = test.info().outputPath("claude");
  const stub = process.env[claudeExecutableVariable];
  const launches = test.info().outputPath("launches");
  // A live session slow to exit keeps the quit going until the refused resume's result reaches the renderer.
  writeFileSync(
    claude,
    `#!/bin/sh
case "$1" in
  --version|auth) exec "${stub}" "$@";;
esac
echo >> "${launches}"
"${stub}" "$@"
status=$?
sleep 1
exit $status
`,
  );
  chmodSync(claude, 0o755);
  const { app, page } = await launch({
    captures: [
      captured("edit-and-interrupt-session"),
      captured("resume-with-image-session"),
    ],
    claude,
  });
  await start(page);
  const resumable = savedConversation();
  const listRead = await holdNextListRead(page);
  const resume = page.evaluate((id) => window.agent.resume(id), resumable.id);
  const fifo = await listRead();
  const closed = app.waitForEvent("close");
  await app.evaluate(({ app }) => app.quit());
  writeFileSync(
    fifo,
    JSON.stringify({ version: 1, conversations: [resumable] }),
  );
  closeSync(fifo);
  expect(await resume).toEqual(quitting);
  await closed;
  expect(readFileSync(launches, "utf8")).toBe("\n");
});

test("a conversation, resume or sign-in asked for once the quit begins is refused", async () => {
  const claude = trackedClaude();
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
    claude,
  });
  const id = await start(page);
  const closed = app.waitForEvent("close");
  await app.evaluate(({ app }) => app.quit());
  const refused = await page.evaluate(
    async ({ input, id }) => [
      await window.agent.start(input),
      await window.agent.resume(id),
      await window.agent.signIn(),
    ],
    { input: { folder: workFolder(), firstMessage }, id },
  );
  expect(refused).toEqual([quitting, quitting, quitting]);
  await closed;
  expect(runningCount(claude)).toBe(0);
});

test("clicking the dock icon while the app quits reopens it once", async () => {
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
    claude: trackedClaude(),
  });
  await start(page);
  const closed = app.waitForEvent("close");
  const relaunches = await app.evaluate(({ app }) => {
    let calls = 0;
    Object.assign(app, { relaunch: () => (calls += 1) });
    app.quit();
    app.emit("activate");
    app.emit("activate");
    return calls;
  });
  expect(relaunches).toBe(1);
  await closed;
});

test("the app hides again when it becomes active while it quits", async () => {
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
    claude: trackedClaude(),
  });
  await start(page);
  const closed = app.waitForEvent("close");
  const hides = await app.evaluate(({ app }) => {
    let calls = 0;
    Object.assign(app, { hide: () => (calls += 1) });
    app.emit("did-become-active");
    const before = calls;
    app.quit();
    app.emit("did-become-active");
    return [before, calls];
  });
  expect(hides).toEqual([0, process.platform === "darwin" ? 2 : 1]);
  await closed;
});

test("opening the app while it quits reopens it once the quit finishes", async () => {
  const claude = trackedClaude();
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
    claude,
  });
  await start(page);
  const closed = app.waitForEvent("close");
  await app.evaluate(({ app }) => app.quit());
  const userData = test.info().outputPath("user-data");
  const mainProcesses = () =>
    execFileSync("ps", ["-ax", "-o", "pid=,command="], { encoding: "utf8" })
      .split("\n")
      .filter((line) => line.includes(userData) && !line.includes("--type="))
      .map((line) => Number.parseInt(line.trim(), 10));
  const electronPath = String(createRequire(import.meta.url)("electron"));
  try {
    const second = spawn(electronPath, appArgs(), {
      stdio: "ignore",
      timeout: 10_000,
    });
    const [code] = await once(second, "exit");
    expect(code).toBe(0);
    await closed;
    await expect.poll(mainProcesses).toHaveLength(1);
  } finally {
    for (const pid of mainProcesses()) process.kill(pid);
  }
  await expect.poll(() => runningCount(claude)).toBe(0);
});
