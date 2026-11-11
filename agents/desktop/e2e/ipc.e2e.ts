import { expect, type Page, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AgentEventKind } from "../src/main/agent/session";
import { claudeExecutableVariable } from "../src/main/claude-executable";
import { type AgentApi, IpcChannel } from "../src/shared/ipc";
import {
  authStatusCapture,
  captured,
  launch,
  runningCount,
  trackedClaude,
  workFolder,
} from "./launch";

// page.evaluate callbacks run in the renderer, where the preload defines window.agent.
declare const window: { agent: AgentApi };

const firstMessage = "Change hello to goodbye in a.txt";

/** Resolves to the started conversation's id once its first turn ends. */
async function start(page: Page): Promise<string> {
  const started = await page.evaluate(
    async ({ input, turnEnded }) => {
      const ended = new Promise<void>((resolve) => {
        window.agent.onEvent(({ event }) => {
          if (event.kind === turnEnded) resolve();
        });
      });
      const result = await window.agent.start(input);
      if (result.ok) await ended;
      return result;
    },
    {
      input: { folder: workFolder(), firstMessage },
      turnEnded: AgentEventKind.TurnEnded,
    },
  );
  if (!started.ok) throw new Error(started.error);
  return started.value.id;
}

/** Sends text, interrupting right after when interrupt is set, and resolves to "turn ended", "turn stopped", "still running" after 5 s, or the send's error. */
function sendTurn(
  page: Page,
  params: { sessionId: string; text: string; interrupt?: boolean },
): Promise<string> {
  return page.evaluate(
    async ({ sessionId, text, interrupt, turnEnded }) => {
      const ended = new Promise<string>((resolve) => {
        window.agent.onEvent((event) => {
          if (event.sessionId === sessionId && event.event.kind === turnEnded)
            resolve(
              "interrupted" in event.event && event.event.interrupted
                ? "turn stopped"
                : "turn ended",
            );
        });
        setTimeout(() => resolve("still running"), 5_000);
      });
      const sent = window.agent.send({ sessionId, text });
      if (interrupt) window.agent.interrupt(sessionId);
      const result = await sent;
      return result.ok ? ended : result.error;
    },
    { ...params, turnEnded: AgentEventKind.TurnEnded },
  );
}

test("a conversation can be resumed after a relaunch", async () => {
  const first = await launch({
    captures: [captured("edit-and-interrupt-session")],
  });
  const sessionId = await start(first.page);
  await first.app.close();

  const second = await launch({
    captures: [captured("resume-with-image-session")],
  });
  const listed = await second.page.evaluate(() =>
    window.agent.listConversations(),
  );
  expect(listed.ok && listed.value.map((c) => c.id)).toEqual([sessionId]);
  const resumed = await second.page.evaluate(
    (id) => window.agent.resume(id),
    sessionId,
  );
  expect(resumed.ok && resumed.value.conversation.title).toBe(firstMessage);
  expect(
    await sendTurn(second.page, { sessionId, text: "Reply with pong" }),
  ).toBe("turn ended");
  await second.app.close();
});

test("a stop sent right after a message stops that turn", async () => {
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
  });
  const sessionId = await start(page);
  expect(
    await sendTurn(page, {
      sessionId,
      text: "Count to 100, one number per line",
      interrupt: true,
    }),
  ).toBe("turn stopped");
  await app.close();
});

test("resuming a conversation whose folder is gone names the folder", async () => {
  const userData = test.info().outputPath("user-data");
  const folder = test.info().outputPath("removed");
  mkdirSync(userData, { recursive: true });
  writeFileSync(
    path.join(userData, "conversations.json"),
    JSON.stringify({
      version: 1,
      conversations: [
        {
          id: "gone",
          folder,
          title: "Gone",
          startedAt: "2026-11-10T12:00:00.000Z",
        },
      ],
    }),
  );
  const { app, page } = await launch({ captures: [] });
  const resumed = await page.evaluate(() => window.agent.resume("gone"));
  expect(resumed).toEqual({ ok: false, error: `${folder} doesn't exist.` });
  await app.close();
});

test("a message to an unopened conversation, or a start in a file, is refused", async () => {
  const file = test.info().outputPath("a.txt");
  writeFileSync(file, "hello");
  const { app, page } = await launch({ captures: [] });
  const results = await page.evaluate(
    async (folder) => [
      await window.agent.send({ sessionId: "never-opened", text: "Hi" }),
      await window.agent.start({ folder, firstMessage: "Hi" }),
    ],
    file,
  );
  expect(results).toEqual([
    { ok: false, error: "This conversation isn't open. Reopen it." },
    { ok: false, error: `${file} isn't a folder.` },
  ]);
  await app.close();
});

test("a conversation that can't be saved closes its CLI and fails to start", async () => {
  mkdirSync(test.info().outputPath("user-data", "conversations.json"), {
    recursive: true,
  });
  const claude = trackedClaude();
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
    claude,
  });
  const started = await page.evaluate((input) => window.agent.start(input), {
    folder: workFolder(),
    firstMessage,
  });
  expect(!started.ok && started.error).toContain("EISDIR");
  expect(runningCount(claude)).toBe(0);
  await app.close();
});

test("an invalid argument comes back as an error, even without Claude Code", async () => {
  const { app, page } = await launch({
    captures: [],
    path: ["/usr/bin", "/bin"].join(path.delimiter),
  });
  await app.evaluate(() => {
    process.on("uncaughtException", (error) =>
      Object.assign(globalThis, { uncaught: error.message }),
    );
  });
  const results = await page.evaluate(async () => {
    window.agent.interrupt("");
    return [
      await window.agent.start({ folder: "relative", firstMessage: "Hello" }),
      await window.agent.resume(""),
      await window.agent.send({ sessionId: "some-id", text: "  \n" }),
    ];
  });
  expect(results).toEqual([
    { ok: false, error: expect.stringContaining("not an absolute path") },
    { ok: false, error: expect.stringContaining("Invalid argument") },
    { ok: false, error: expect.stringContaining("an empty message") },
  ]);
  expect(
    await app.evaluate(() => Reflect.get(globalThis, "uncaught")),
  ).toBeUndefined();
  await app.close();
});

test("a handler that throws comes back as an error", async () => {
  const { app, page } = await launch({ captures: [] });
  await app.evaluate(({ ipcMain }, channel) => {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, () => {
      throw new Error("boom");
    });
  }, IpcChannel.Start);
  const result = await page.evaluate((input) => window.agent.start(input), {
    folder: workFolder(),
    firstMessage,
  });
  expect(result).toEqual({ ok: false, error: expect.stringContaining("boom") });
  await app.close();
});

test("a Claude Code installed while the app runs is found on the next check", async () => {
  const bin = test.info().outputPath("bin");
  mkdirSync(bin);
  const { app, page } = await launch({
    captures: [authStatusCapture(true)],
    path: [bin, "/usr/bin", "/bin"].join(path.delimiter),
  });
  const before = await page.evaluate(() => window.agent.claudeSignedIn());
  expect(!before.ok && before.error).toContain("couldn't find Claude Code");
  // The stub's shebang needs bun, which the narrowed PATH leaves out.
  const bun = execFileSync("sh", ["-c", "command -v bun"], {
    encoding: "utf8",
  }).trim();
  writeFileSync(
    path.join(bin, "claude"),
    `#!/bin/sh\nexec "${bun}" "${process.env[claudeExecutableVariable]}" "$@"\n`,
  );
  chmodSync(path.join(bin, "claude"), 0o755);
  expect(await page.evaluate(() => window.agent.claudeSignedIn())).toEqual({
    ok: true,
    value: true,
  });
  await app.close();
});
