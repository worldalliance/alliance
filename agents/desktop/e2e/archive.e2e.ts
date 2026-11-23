import { expect, type Page, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  closeSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { setTimeout } from "node:timers/promises";
import { executableVariable } from "../src/main/cli-executable";
import { AgentKind } from "../src/shared/agent-kind";
import type { AgentApi } from "../src/shared/ipc";
import { askWithoutWorktree, send } from "./chat-helpers";
import { holdNextListRead } from "./ipc-helpers";
import {
  authStatusCapture,
  captured,
  claudeExecutableVariable,
  launch,
  runningCount,
  sessionClaude,
  slowBootClaude,
  trackedClaude,
  workFolder,
} from "./launch";
import {
  archived,
  conversationsFile,
  firstTurnDone,
  repositoryReady,
  request,
  worktreeEntry,
  worktreeFolder,
  worktreesFile,
} from "./worktree-helpers";

// page.evaluate callbacks run in the renderer, where the preload defines window.agent.
declare const window: { agent: AgentApi };

test("Archive waits for a conversation starting in the worktree, then stops it", async () => {
  const claude = trackedClaude();
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
    claude,
  });
  await repositoryReady(page);
  await send(page, request);
  await firstTurnDone(page);
  await worktreeEntry(page).click();
  const saved = readFileSync(conversationsFile(), "utf8");
  // Start saves the conversation before the session joins the live ones, and the save reads the list first.
  const listRead = await holdNextListRead(page);
  await send(page, "Say hello");
  const fifo = await listRead();

  const archive = page.getByRole("button", { name: "Archive" });
  await expect(archive).toHaveAttribute("aria-disabled", "true");
  await expect(
    page.getByText(
      "You can archive this worktree once the new conversation has started.",
    ),
  ).toBeVisible();
  writeFileSync(fifo, saved);
  closeSync(fifo);
  await expect(page.locator(".user")).toHaveText("Say hello");
  await worktreeEntry(page).click();
  await archive.click();
  await expect(archived(page)).toBeVisible();
  await expect.poll(() => runningCount(claude)).toBe(0);
  await app.close();
});

test("archiving a worktree stops a conversation still starting in it", async () => {
  const claude = trackedClaude();
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
    claude,
  });
  await repositoryReady(page);
  await send(page, request);
  await firstTurnDone(page);
  await worktreeEntry(page).click();
  const saved = readFileSync(conversationsFile(), "utf8");
  const listRead = await holdNextListRead(page);
  // Started past the worktree's form, which Archive waits for.
  const started = page.evaluate((input) => window.agent.start(input), {
    folder: worktreeFolder(),
    firstMessage: "Say hello",
    agent: AgentKind.Claude,
  });
  const fifo = await listRead();

  await page.getByRole("button", { name: "Archive" }).click();
  writeFileSync(fifo, saved);
  closeSync(fifo);
  await expect(archived(page)).toBeVisible();
  expect((await started).ok).toBe(true);
  await expect.poll(() => runningCount(claude)).toBe(0);
  await app.close();
});

test("a conversation that began starting in a worktree before Archive and starts after Archive finished is stopped", async () => {
  const claude = trackedClaude();
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
    claude,
    env: { ALLIANCE_AGENT_OPENING_WAIT_MS: "500" },
  });
  await repositoryReady(page);
  await send(page, request);
  await firstTurnDone(page);
  await worktreeEntry(page).click();
  const saved = readFileSync(conversationsFile(), "utf8");
  const listRead = await holdNextListRead(page);
  const started = page.evaluate((input) => window.agent.start(input), {
    folder: worktreeFolder(),
    firstMessage: "Say hello",
    agent: AgentKind.Claude,
  });
  const fifo = await listRead();

  await page.getByRole("button", { name: "Archive" }).click();
  await expect(archived(page)).toBeVisible();
  writeFileSync(fifo, saved);
  closeSync(fifo);
  await started;
  await expect.poll(() => runningCount(claude)).toBe(0);
  await app.close();
});

test("archiving a worktree waits at most the opening wait for a conversation starting elsewhere", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
    env: { ALLIANCE_AGENT_OPENING_WAIT_MS: "500" },
  });
  await repositoryReady(page);
  await send(page, request);
  await firstTurnDone(page);
  await askWithoutWorktree(page);
  const saved = readFileSync(conversationsFile(), "utf8");
  const listRead = await holdNextListRead(page);
  await send(page, "Say hello");
  const fifo = await listRead();

  await worktreeEntry(page).click();
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(archived(page)).toBeVisible();
  writeFileSync(fifo, saved);
  closeSync(fifo);
  await app.close();
});

test("an archive still running when the user comes back to its worktree still shows, with no new conversation form", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
    env: { ALLIANCE_AGENT_OPENING_WAIT_MS: "30000" },
  });
  await repositoryReady(page);
  await send(page, request);
  await firstTurnDone(page);
  await askWithoutWorktree(page);
  const saved = readFileSync(conversationsFile(), "utf8");
  const listRead = await holdNextListRead(page);
  await send(page, "Say hello");
  const fifo = await listRead();

  await worktreeEntry(page).click();
  await page.getByRole("button", { name: "Archive" }).click();
  await askWithoutWorktree(page);
  await worktreeEntry(page).click();
  await expect(
    page.getByRole("button", { name: "Archiving…" }),
  ).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByLabel("Message Claude")).toHaveCount(0);
  writeFileSync(fifo, saved);
  closeSync(fifo);
  await expect(archived(page)).toBeVisible();
  await app.close();
});

/** A Codex whose app-server never answers initialize, so a Codex start stalls until release, when it exits and the start fails. */
function stallingCodex(): { codex: string; release: () => void } {
  const codex = test.info().outputPath("codex");
  const released = test.info().outputPath("codex-released");
  writeFileSync(
    codex,
    `#!/bin/sh\ncase " $* " in *" app-server "*) until [ -e "${released}" ]; do sleep 0.1; done; exit 0;; esac\nexec "${process.env[executableVariable(AgentKind.Codex)]}" "$@"\n`,
  );
  chmodSync(codex, 0o755);
  return { codex, release: () => writeFileSync(released, "") };
}

// On Linux the stalled Codex inherits the pipes Playwright gave the app, so each test releases it before app.close, which waits for them.
const stallCodexStart = (page: Page) =>
  page.evaluate((input) => window.agent.start(input), {
    folder: workFolder(),
    firstMessage: "Hello",
    agent: AgentKind.Codex,
  });

test("a conversation started in an archived worktree after Archive finished keeps running while a start elsewhere stalls", async () => {
  const claude = trackedClaude();
  const codex = stallingCodex();
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
    claude,
    env: {
      [executableVariable(AgentKind.Codex)]: codex.codex,
      ALLIANCE_AGENT_OPENING_WAIT_MS: "500",
    },
  });
  await repositoryReady(page);
  await send(page, request);
  await firstTurnDone(page);
  const stalled = stallCodexStart(page);
  await worktreeEntry(page).click();
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(archived(page)).toBeVisible();
  await expect.poll(() => runningCount(claude)).toBe(0);

  const started = await page.evaluate((input) => window.agent.start(input), {
    folder: worktreeFolder(),
    firstMessage: "Say hello",
    agent: AgentKind.Claude,
  });
  expect(started.ok).toBe(true);
  // Outlasts the opening wait, after which a closer would have closed it.
  await setTimeout(1_500);
  expect(runningCount(claude)).toBe(1);
  codex.release();
  await stalled;
  await app.close();
});

test("a resume or start in a worktree while Archive stops its agents is refused", async () => {
  const claude = trackedClaude();
  const codex = stallingCodex();
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
    claude,
    env: {
      [executableVariable(AgentKind.Codex)]: codex.codex,
      // Archive waits on the stalled start until the test releases it.
      ALLIANCE_AGENT_OPENING_WAIT_MS: "60000",
    },
  });
  await repositoryReady(page);
  await send(page, request);
  await firstTurnDone(page);
  const [{ id }]: { id: string }[] = JSON.parse(
    readFileSync(conversationsFile(), "utf8"),
  ).conversations;
  const stalled = stallCodexStart(page);
  await worktreeEntry(page).click();
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByRole("button", { name: "Archiving…" })).toBeVisible();
  // Archive has begun stopping the worktree's agents, and waits on the stalled start.
  await expect.poll(() => runningCount(claude)).toBe(0);

  const resumed = await page.evaluate((id) => window.agent.resume(id), id);
  expect(resumed).toEqual({
    ok: false,
    error: "This conversation is closing. Try again in a moment.",
  });
  const started = await page.evaluate((input) => window.agent.start(input), {
    folder: worktreeFolder(),
    firstMessage: "Say hello",
    agent: AgentKind.Claude,
  });
  expect(started).toEqual({
    ok: false,
    error: "Conversations in this folder are closing. Try again in a moment.",
  });
  codex.release();
  await stalled;
  await expect(archived(page)).toBeVisible();
  await expect.poll(() => runningCount(claude)).toBe(0);
  await app.close();
});

test("a resume that reaches the main process after Archive finished is refused", async () => {
  const claude = trackedClaude();
  const codex = stallingCodex();
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
    claude,
    env: {
      [executableVariable(AgentKind.Codex)]: codex.codex,
      // Archive waits on the stalled start until the test releases it.
      ALLIANCE_AGENT_OPENING_WAIT_MS: "60000",
    },
  });
  await repositoryReady(page);
  await send(page, request);
  await firstTurnDone(page);
  const saved = readFileSync(conversationsFile(), "utf8");
  const [{ id }]: { id: string }[] = JSON.parse(saved).conversations;
  const stalled = stallCodexStart(page);
  await worktreeEntry(page).click();
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByRole("button", { name: "Archiving…" })).toBeVisible();
  // Archive begins closing once its save lands; a Resume begun before that is one of the openings it waits for.
  await expect
    .poll(() => readFileSync(worktreesFile(), "utf8"))
    .toContain('"archived": true');
  // Resume reads the saved conversations first, so holding that read lets Archive finish before Resume checks anything.
  const listRead = await holdNextListRead(page);
  const resumed = page.evaluate(
    (sessionId) =>
      window.agent
        .resume(sessionId)
        .then((reply) => (reply.ok ? "resumed" : reply.error)),
    id,
  );
  const fifo = await listRead();
  codex.release();
  await stalled;
  await expect(archived(page)).toBeVisible();
  writeFileSync(fifo, saved);
  closeSync(fifo);
  expect(await resumed).toBe(
    "This worktree is archived. Restore it to open this conversation.",
  );
  await expect.poll(() => runningCount(claude)).toBe(0);
  await app.close();
});

test("a conversation of the worktree opened while Archive runs gives way to the archived worktree instead of reopening", async () => {
  const claude = trackedClaude();
  const codex = stallingCodex();
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
    claude,
    env: {
      [executableVariable(AgentKind.Codex)]: codex.codex,
      // Archive waits on the stalled start until the test releases it.
      ALLIANCE_AGENT_OPENING_WAIT_MS: "60000",
    },
  });
  await repositoryReady(page);
  await send(page, request);
  await firstTurnDone(page);
  const stalled = stallCodexStart(page);
  await worktreeEntry(page).click();
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByRole("button", { name: "Archiving…" })).toBeVisible();
  await page.getByRole("navigation").locator("ul.nested button").click();
  await expect(page.locator(".user")).toHaveText(request);

  codex.release();
  await stalled;
  await expect(page.getByRole("button", { name: "Restore" })).toBeVisible();
  await expect(archived(page)).toBeVisible();
  await expect.poll(() => runningCount(claude)).toBe(0);
  await app.close();
});

test("archiving a worktree keeps a conversation whose CLI hasn't read its first message yet, and refuses to resume it until it closes", async () => {
  const { claude, cutBeforeBoot } = slowBootClaude();
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
    claude,
  });
  await repositoryReady(page);
  await send(page, request);
  await firstTurnDone(page);
  await worktreeEntry(page).click();
  await send(page, "Say hello");
  await expect(page.locator(".user")).toHaveText("Say hello");
  const listed = await page.evaluate(() => window.agent.listConversations());
  const id = listed.ok
    ? listed.value.find((c) => c.title === "Say hello")?.id
    : undefined;
  if (!id) throw new Error("the conversation isn't listed");
  await worktreeEntry(page).click();
  await page.getByRole("button", { name: "Archive" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        (sessionId) =>
          window.agent
            .resume(sessionId)
            .then((resumed) => (resumed.ok ? "resumed" : resumed.error)),
        id,
      ),
    )
    .toBe("This conversation is closing. Try again in a moment.");
  await expect(archived(page)).toBeVisible({ timeout: 15_000 });
  await app.close();
  expect(existsSync(cutBeforeBoot)).toBe(false);
  expect(readFileSync(conversationsFile(), "utf8")).toContain("Say hello");
});

test("a resume asked for while archiving closes a worktree's conversation is refused, even once the close has finished", async () => {
  const exiting = test.info().outputPath("exiting");
  const gate = test.info().outputPath("exit-gate");
  execFileSync("mkfifo", [gate]);
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
    claude: sessionClaude(`"${process.env[claudeExecutableVariable]}" "$@"
status=$?
if [ ! -e "${exiting}" ]; then
  touch "${exiting}"
  cat "${gate}" > /dev/null
fi
exit $status`),
  });
  await repositoryReady(page);
  await send(page, request);
  await firstTurnDone(page);
  const listed = await page.evaluate(() => window.agent.listConversations());
  const id = listed.ok ? listed.value[0]?.id : undefined;
  if (!id) throw new Error("the conversation isn't listed");
  await worktreeEntry(page).click();
  await page.getByRole("button", { name: "Archive" }).click();
  await expect.poll(() => existsSync(exiting)).toBe(true);
  const resumed = page.evaluate(
    (sessionId) =>
      window.agent
        .resume(sessionId)
        .then((reply) => (reply.ok ? "resumed" : reply.error)),
    id,
  );
  // A resume that isn't refused waits for this CLI to exit, so the gate opens after a while either way.
  await Promise.race([resumed, setTimeout(5_000)]);
  writeFileSync(gate, "");
  expect(await resumed).toBe(
    "This conversation is closing. Try again in a moment.",
  );
  await expect(archived(page)).toBeVisible();
  await app.close();
});
