import { expect, type Page, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AgentEventKind } from "../src/shared/agent-event";
import { AgentKind } from "../src/shared/agent-kind";
import { type AgentApi, IpcChannel } from "../src/shared/ipc";
import { firstMessage, start } from "./ipc-helpers";
import {
  authStatusCapture,
  captured,
  claudeExecutableVariable,
  launch,
  runningCount,
  trackedClaude,
  unreadingClaude,
  workFolder,
} from "./launch";

// page.evaluate callbacks run in the renderer, where the preload defines window.agent.
declare const window: { agent: AgentApi };

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

test("resuming a conversation that is still live doesn't repeat its events", async () => {
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
  });
  const sessionId = await start(page);
  const resumed = await page.evaluate(
    (id) => window.agent.resume(id),
    sessionId,
  );
  expect(resumed.ok).toBe(true);
  const turnEnds = await page.evaluate(
    async ({ sessionId, turnEnded }) => {
      let count = 0;
      const ended = new Promise<void>((resolve) => {
        window.agent.onEvent((event) => {
          if (event.sessionId !== sessionId || event.event.kind !== turnEnded)
            return;
          count += 1;
          resolve();
        });
      });
      const sent = await window.agent.send({
        sessionId,
        text: "Count to 100, one number per line",
      });
      if (!sent.ok) return sent.error;
      window.agent.interrupt(sessionId);
      await ended;
      await new Promise((resolve) => setTimeout(resolve, 500));
      return count;
    },
    { sessionId, turnEnded: AgentEventKind.TurnEnded },
  );
  expect(turnEnds).toBe(1);
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
    async ({ folder, agent }) => [
      await window.agent.send({ sessionId: "never-opened", text: "Hi" }),
      await window.agent.start({ folder, firstMessage: "Hi", agent }),
    ],
    { folder: file, agent: AgentKind.Claude },
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
    agent: AgentKind.Claude,
  });
  expect(!started.ok && started.error).toContain("EISDIR");
  expect(runningCount(claude)).toBe(0);
  await app.close();
});

test("a folder picker that fails to open comes back as an error", async () => {
  const { app, page } = await launch({ captures: [] });
  await app.evaluate(({ dialog }) => {
    Object.assign(dialog, {
      showOpenDialog: () => Promise.reject(new Error("No display")),
    });
  });
  expect(await page.evaluate(() => window.agent.chooseFolder())).toEqual({
    ok: false,
    error: "No display",
  });
  await app.close();
});

test("a canceled folder picker comes back as no folder", async () => {
  const { app, page } = await launch({ captures: [] });
  await app.evaluate(({ dialog }) => {
    Object.assign(dialog, {
      showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] }),
    });
  });
  expect(await page.evaluate(() => window.agent.chooseFolder())).toEqual({
    ok: true,
    value: undefined,
  });
  await app.close();
});

test("a new conversation whose CLI exits before reading its first message is removed, and the window told", async () => {
  const { app, page } = await launch({
    captures: [],
    claude: unreadingClaude(),
  });
  const ids = await page.evaluate(
    async (input) => {
      const removed = new Promise<string>((resolve) =>
        window.agent.onConversationRemoved(resolve),
      );
      const started = await window.agent.start(input);
      if (!started.ok) throw new Error(started.error);
      return { started: started.value.id, removed: await removed };
    },
    { folder: workFolder(), firstMessage, agent: AgentKind.Claude },
  );
  expect(ids.removed).toBe(ids.started);
  expect(await page.evaluate(() => window.agent.listConversations())).toEqual({
    ok: true,
    value: [],
  });
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
  const results = await page.evaluate(async (agent) => {
    window.agent.interrupt("");
    const unknownField = {
      folder: "/",
      firstMessage: "Hello",
      agent,
      model: "x",
    };
    return [
      await window.agent.start({
        folder: "relative",
        firstMessage: "Hello",
        agent,
      }),
      await window.agent.start(unknownField),
      await window.agent.resume(""),
      await window.agent.send({ sessionId: "some-id", text: "  \n" }),
      // @ts-expect-error -- an agent the app doesn't know
      await window.agent.signedIn("gemini"),
    ];
  }, AgentKind.Claude);
  expect(results).toEqual([
    { ok: false, error: expect.stringContaining("not an absolute path") },
    { ok: false, error: expect.stringContaining('"model"') },
    { ok: false, error: expect.stringContaining("Invalid argument") },
    { ok: false, error: expect.stringContaining("an empty message") },
    { ok: false, error: expect.stringContaining("Invalid argument") },
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
    agent: AgentKind.Claude,
  });
  expect(result).toEqual({ ok: false, error: expect.stringContaining("boom") });
  await app.close();
});

test("a page other than the app's own is refused and hears no session events", async () => {
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
  });
  const opened = app.waitForEvent("window");
  await app.evaluate(({ BrowserWindow }, preload) => {
    void new BrowserWindow({
      show: false,
      webPreferences: { preload },
    }).loadURL("data:text/html,<p>other</p>");
  }, path.resolve("out/preload/index.cjs"));
  const other = await opened;
  const result = await other.evaluate((input) => window.agent.start(input), {
    folder: workFolder(),
    firstMessage,
    agent: AgentKind.Claude,
  });
  expect(result).toEqual({
    ok: false,
    error: expect.stringContaining("outside the app's page"),
  });
  await other.evaluate(() => {
    const heard: unknown[] = [];
    Object.assign(globalThis, { heard });
    window.agent.onEvent((event) => heard.push(event));
  });
  const sessionId = await start(page);
  await page.evaluate(
    ({ sessionId, turnEnded }) => {
      const ended = new Promise<string>((resolve) =>
        window.agent.onEvent((event) => {
          if (event.sessionId === sessionId && event.event.kind === turnEnded)
            resolve("turn ended");
        }),
      );
      Object.assign(globalThis, { ended });
      return window.agent.send({
        sessionId,
        text: "Count to 100, one number per line",
      });
    },
    { sessionId, turnEnded: AgentEventKind.TurnEnded },
  );
  await other.evaluate((id) => window.agent.interrupt(id), sessionId);
  // The capture's turn waits for an interrupt, so it ends only if the other page's got through.
  expect(
    await page.evaluate(() =>
      Promise.race([
        Reflect.get(globalThis, "ended"),
        new Promise((resolve) => setTimeout(resolve, 1_000, "still running")),
      ]),
    ),
  ).toBe("still running");
  expect(await other.evaluate(() => Reflect.get(globalThis, "heard"))).toEqual(
    [],
  );
  await app.close();
});

test("a Claude Code installed while the app runs is found on the next check", async () => {
  const bin = test.info().outputPath("bin");
  mkdirSync(bin);
  const { app, page } = await launch({
    captures: [authStatusCapture(true)],
    path: [bin, "/usr/bin", "/bin"].join(path.delimiter),
  });
  const signedIn = () =>
    page.evaluate((agent) => window.agent.signedIn(agent), AgentKind.Claude);
  const before = await signedIn();
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
  expect(await signedIn()).toEqual({
    ok: true,
    value: true,
  });
  await app.close();
});
