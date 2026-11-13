import { expect, type Page, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
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
import path from "node:path";
import { claudeExecutableVariable } from "../src/main/claude-executable";
import { AgentEventKind } from "../src/shared/agent-event";
import type { AgentApi } from "../src/shared/ipc";
import { firstMessage, start } from "./ipc-helpers";
import {
  captured,
  launch,
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

function writeClaude(script: string): string {
  const claude = test.info().outputPath("claude");
  writeFileSync(claude, `#!/bin/sh\n${script}`);
  chmodSync(claude, 0o755);
  return claude;
}

const savedConversations = (): { id: string }[] =>
  JSON.parse(
    readFileSync(
      test.info().outputPath("user-data", "conversations.json"),
      "utf8",
    ),
  ).conversations;

/** Replaces the saved conversation list with a FIFO once any read already under way has finished, so the next read waits until the test writes the list. */
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
});

test("quitting waits only so long for a conversation still starting", async () => {
  const claude = writeClaude(
    `sleep 15\nexec "${process.env[claudeExecutableVariable]}" "$@"\n`,
  );
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
  // On Linux the CLI inherits the pipes Playwright gave the app, so app.close also waits out the left-behind sleep; the app's own exit is what's timed.
  const exited = once(app.process(), "exit");
  const quitAt = Date.now();
  await app.evaluate(({ app }) => app.quit());
  await exited;
  expect(Date.now() - quitAt).toBeLessThan(10_000);
  await app.close();
  await expect.poll(() => runningCount(claude), { timeout: 20_000 }).toBe(0);
});

test("quitting closes live conversations without waiting for one still starting", async () => {
  const stub = process.env[claudeExecutableVariable];
  const exited = test.info().outputPath("session-exited");
  const claude = writeClaude(`case "$1" in
  --version) mkdir "${test.info().outputPath("checked")}" 2>/dev/null || sleep 8; exec "${stub}" "$@";;
  auth) exec "${stub}" "$@";;
esac
"${stub}" "$@"
status=$?
touch "${exited}"
exit $status
`);
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
  writeClaude(`wait_for() { while [ ! -e "${gates}/$1" ]; do kill -0 $PPID 2>/dev/null || exit 1; sleep 0.05; done; }
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
exit $status
`);
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
  expect(savedConversations().map((c) => c.id)).toEqual([
    ...(started.ok ? [started.value.id] : []),
    resumable.id,
  ]);
});

test("a conversation still saving when the quit begins starts, and its CLI is closed", async () => {
  const claude = trackedClaude();
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
    claude,
  });
  // Start's save reads the list first.
  const listRead = await holdNextListRead(page);
  const started = page.evaluate((input) => window.agent.start(input), {
    folder: workFolder(),
    firstMessage,
  });
  const fifo = await listRead();
  expect(runningCount(claude)).toBe(1);
  const closed = app.waitForEvent("close");
  await app.evaluate(({ app }) => app.quit());
  writeFileSync(fifo, JSON.stringify({ version: 1, conversations: [] }));
  closeSync(fifo);
  const conversation = await started;
  await closed;
  expect(runningCount(claude)).toBe(0);
  expect(savedConversations().map((c) => c.id)).toEqual(
    conversation.ok ? [conversation.value.id] : [],
  );
  expect(conversation.ok).toBe(true);
});

test("a resume still reading the saved conversations when the quit begins launches no CLI", async () => {
  const stub = process.env[claudeExecutableVariable];
  const launches = test.info().outputPath("launches");
  // A live session slow to exit keeps the quit going until the refused resume's result reaches the renderer.
  const claude = writeClaude(`case "$1" in
  --version|auth) exec "${stub}" "$@";;
esac
echo >> "${launches}"
"${stub}" "$@"
status=$?
sleep 1
exit $status
`);
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
