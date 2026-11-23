import { expect, type Page, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { CaptureRecordKind } from "../src/main/agent/claude/testing/capture";
import { AgentKind } from "../src/shared/agent-kind";
import { IpcChannel } from "../src/shared/ipc";
import { writeConversations } from "./chat-helpers";
import {
  authStatusCapture,
  claudeExecutableVariable,
  launch,
  writeClaude,
  writeTestCapture,
} from "./launch";

/** A claude that runs script, which sees the CLI's arguments, then the stub unless script exited. */
const wrapClaude = (script: string): string =>
  writeClaude(
    `${script}\nexec "${process.env[claudeExecutableVariable]}" "$@"\n`,
  );

// New worktree shows while signed out too, so only the message box shows the sign-in finished.
const expectSignedIn = async (page: Page) => {
  await expect(page.getByLabel("Message Claude")).toBeEditable();
  await expect(
    page.getByRole("heading", { name: "Sign in to Claude" }),
  ).toHaveCount(0);
  await expect(page.getByText("Checking your Claude sign-in")).toHaveCount(0);
};

test("cancelling sign-in, by click or keyboard but not a held key, returns to the sign-in panel without an error", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(false)],
    claude: wrapClaude('[ "$2" = login ] && exec sleep 30'),
  });
  await page.getByRole("button", { name: "Sign in to Claude" }).click();
  const cancel = page.getByRole("button", { name: "Cancel sign-in" });
  await expect(cancel).toBeFocused();
  await expect(cancel).toHaveAccessibleDescription(
    "Continue in your browser to finish signing in.",
  );
  await cancel.click();
  const signIn = page.getByRole("button", { name: "Sign in to Claude" });
  await expect(signIn).toBeFocused();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.keyboard.down("Enter");
  await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  // A cancel takes effect only once the CLI exits, so the wait lets a wrong one show.
  await page.waitForTimeout(500);
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(signIn).toBeFocused();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await app.close();
});

test("cancelling sign-in says so while the CLI takes its time to exit", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(false)],
    claude: wrapClaude(`[ "$2" = login ] && trap '' TERM && exec sleep 30`),
  });
  await page.getByRole("button", { name: "Sign in to Claude" }).click();
  const cancel = page.getByRole("button", { name: "Cancel sign-in" });
  await cancel.click();
  await expect(page.getByRole("status")).toHaveText("Cancelling sign-in…");
  await expect(cancel).toBeFocused();
  await expect(cancel).toHaveAttribute("aria-disabled", "true");
  await expect(
    page.getByRole("button", { name: "Sign in to Claude" }),
  ).toBeFocused();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await app.close();
});

test("a sign-in cancelled after it finished in the browser leaves the sign-in panel", async () => {
  const signedIn = test.info().outputPath("signed-in");
  const { app, page } = await launch({
    captures: [authStatusCapture(false)],
    claude: wrapClaude(
      [
        `[ "$2" = login ] && trap 'kill $!; exit 0' TERM && touch "${signedIn}" && { sleep 30 & wait $!; }`,
        `[ "$2" = status ] && [ -e "${signedIn}" ] && echo '{"loggedIn":true}' && exit 0`,
      ].join("\n"),
    ),
  });
  await page.getByRole("button", { name: "Sign in to Claude" }).click();
  await expect.poll(() => existsSync(signedIn)).toBe(true);
  await page.getByRole("button", { name: "Cancel sign-in" }).click();
  await expectSignedIn(page);
  await app.close();
});

test("a double-click on Sign in doesn't cancel the sign-in it starts", async () => {
  const started = test.info().outputPath("login-started");
  const { app, page } = await launch({
    captures: [authStatusCapture(false)],
    claude: wrapClaude(
      `[ "$2" = login ] && touch "${started}" && exec sleep 30`,
    ),
  });
  await page.getByRole("button", { name: "Sign in to Claude" }).dblclick();
  await expect.poll(() => existsSync(started)).toBe(true);
  await expect(
    page.getByRole("button", { name: "Cancel sign-in" }),
  ).toBeVisible();
  await app.close();
});

test("a double-click or held Enter on Cancel sign-in doesn't sign in again", async () => {
  const logins = test.info().outputPath("logins");
  mkdirSync(logins);
  const { app, page } = await launch({
    captures: [authStatusCapture(false)],
    claude: wrapClaude(
      `[ "$2" = login ] && touch "${logins}/$$" && exec sleep 30`,
    ),
  });
  const signIn = page.getByRole("button", { name: "Sign in to Claude" });
  const cancel = page.getByRole("button", { name: "Cancel sign-in" });
  const started = () => readdirSync(logins).length;
  await signIn.click();
  await expect.poll(started).toBe(1);
  // The page clicks Sign in itself, stamped 100 ms after Cancel's click, since round trips to the test and the sign-in recheck can outlast pressOnce's double-click window. The script is a string because the e2e tests compile without DOM types, and returns nothing so the evaluate doesn't wait for that click.
  await page.evaluate(`
    void (globalThis.secondClick = new Promise((resolve) => {
      let cancelledAt;
      document.addEventListener("click", (event) => { cancelledAt ??= event.timeStamp; }, { capture: true });
      const observer = new MutationObserver(() => {
        const button = Array.from(document.querySelectorAll("button")).find(
          (b) => b.textContent === "Sign in to Claude",
        );
        if (!button) return;
        observer.disconnect();
        const click = new MouseEvent("click", { bubbles: true, detail: 2 });
        Object.defineProperty(click, "timeStamp", { value: cancelledAt + 100 });
        button.dispatchEvent(click);
        resolve();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }));
  `);
  await cancel.click();
  await page.evaluate(() => Reflect.get(globalThis, "secondClick"));
  await expect(signIn).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(started).toBe(2);
  await expect(cancel).toBeFocused();
  await page.keyboard.down("Enter");
  await expect(signIn).toBeFocused();
  await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  // A sign-in starts its CLI asynchronously, so the wait lets a wrong one show.
  await page.waitForTimeout(500);
  await expect(signIn).toBeFocused();
  expect(started()).toBe(2);
  await app.close();
});

test("a sign-in that finishes leaves the sign-in panel", async () => {
  const signedIn = test.info().outputPath("signed-in");
  const { app, page } = await launch({
    captures: [authStatusCapture(false)],
    claude: wrapClaude(
      [
        `[ "$2" = login ] && touch "${signedIn}" && exit 0`,
        `[ "$2" = status ] && [ -e "${signedIn}" ] && echo '{"loggedIn":true}' && exit 0`,
      ].join("\n"),
    ),
  });
  await page.getByRole("button", { name: "Sign in to Claude" }).click();
  await expectSignedIn(page);
  await app.close();
});

test("a sign-in that finishes while Claude Code still reports signed out says so", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(false)],
    claude: wrapClaude('[ "$2" = login ] && exit 0'),
  });
  await page.getByRole("button", { name: "Sign in to Claude" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Sign-in didn't finish. Try signing in again.",
  );
  await expect(
    page.getByRole("button", { name: "Sign in to Claude" }),
  ).toBeFocused();
  await page.getByText("Details").click();
  await expect(page.getByRole("alert").locator("pre")).toHaveText(
    "Claude Code still reports you're signed out.",
  );
  await app.close();
});

test("a signed-out user is asked to sign in, in place of the message box, before starting", async () => {
  const { app, page } = await launch({ captures: [authStatusCapture(false)] });
  await expect(
    page.getByRole("heading", { name: "Sign in to Claude" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in to Claude" }),
  ).toBeFocused();
  await expect(page.getByLabel("Message Claude")).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Codex" })).toBeVisible();
  await expect(page.getByRole("navigation")).toBeVisible();
  await expect(page).toHaveTitle("New worktree – Alliance agent");
  await app.close();
});

test("a signed-in user isn't asked to sign in", async () => {
  const { app, page } = await launch({ captures: [authStatusCapture(true)] });
  await expectSignedIn(page);
  await app.close();
});

test("the sign-in check's status takes focus without a focus ring", async () => {
  const release = test.info().outputPath("release");
  const { app, page } = await launch({
    captures: [authStatusCapture(false)],
    claude: wrapClaude(
      `[ "$2" = status ] && while [ ! -e "${release}" ]; do sleep 0.05; done`,
    ),
  });
  const status = page.getByRole("status");
  await expect(status).toBeFocused();
  await expect(status).toHaveCSS("outline-style", "none");
  writeFileSync(release, "");
  await expect(
    page.getByRole("heading", { name: "Sign in to Claude" }),
  ).toBeVisible();
  await app.close();
});

test("a failed sign-in says why and offers it again", async () => {
  const { app, page } = await launch({
    captures: [
      authStatusCapture(false),
      writeTestCapture({
        name: "auth-login-failed",
        args: ["auth", "login", "--claudeai"],
        records: [
          {
            kind: CaptureRecordKind.Stderr,
            text: "Login timed out\nTry again later\n",
          },
          { kind: CaptureRecordKind.Exit, code: 1 },
        ],
      }),
    ],
  });
  await page.getByRole("button", { name: "Sign in to Claude" }).click();
  await expect(page.getByRole("alert").locator("p")).toHaveText(
    "Sign-in didn't finish. Try signing in again.",
  );
  const detail = page.getByRole("alert").locator("pre");
  await expect(detail).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Sign in to Claude" }),
  ).toBeFocused();
  await page.getByText("Details").click();
  await expect(detail).toHaveText(
    /claude auth login exited with code 1: Login timed out\nTry again later/,
    { useInnerText: true },
  );
  await app.close();
});

test("a failed sign-in checks the sign-in again without offering to cancel it", async () => {
  const failed = test.info().outputPath("failed");
  const release = test.info().outputPath("release");
  const { app, page } = await launch({
    captures: [authStatusCapture(false)],
    claude:
      wrapClaude(`[ "$2" = login ] && touch "${failed}" && echo boom >&2 && exit 1
[ "$2" = status ] && [ -e "${failed}" ] && while [ ! -e "${release}" ]; do sleep 0.05; done`),
  });
  await page.getByRole("button", { name: "Sign in to Claude" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Checking your Claude sign-in…",
  );
  await expect(
    page.getByRole("button", { name: "Cancel sign-in" }),
  ).toHaveCount(0);
  writeFileSync(release, "");
  await expect(page.getByRole("alert").locator("p")).toHaveText(
    "Sign-in didn't finish. Try signing in again.",
  );
  await app.close();
});

test("a sign-in that fails because Claude Code no longer runs says it isn't available", async () => {
  const claude = wrapClaude("");
  const { app, page } = await launch({
    captures: [authStatusCapture(false)],
    claude,
  });
  const signIn = page.getByRole("button", { name: "Sign in to Claude" });
  await expect(signIn).toBeVisible();
  rmSync(claude);
  await signIn.click();
  await expect(
    page.getByRole("heading", { name: "Claude isn't available" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Check again" })).toBeFocused();
  await page.getByText("Details").click();
  const detail = await page.getByRole("alert").locator("pre").textContent();
  expect(detail?.split("\n")).toHaveLength(1);
  await app.close();
});

test("a failed sign-in whose check then fails keeps both errors under Details", async () => {
  const failed = test.info().outputPath("failed");
  const { app, page } = await launch({
    captures: [authStatusCapture(false)],
    claude:
      wrapClaude(`[ "$2" = login ] && touch "${failed}" && echo 'Login timed out' >&2 && exit 1
[ "$2" = status ] && [ -e "${failed}" ] && echo 'not json' && exit 1`),
  });
  await page.getByRole("button", { name: "Sign in to Claude" }).click();
  await expect(
    page.getByRole("heading", { name: "Claude isn't available" }),
  ).toBeVisible();
  await page.getByText("Details").click();
  const detail = page.getByRole("alert").locator("pre");
  await expect(detail).toContainText("Login timed out");
  await expect(detail).toContainText("not json");
  await app.close();
});

test("Check again, but not a held Enter's repeats, finds Claude Code installed while the app runs", async () => {
  const bin = test.info().outputPath("bin");
  mkdirSync(bin);
  const { app, page } = await launch({
    captures: [authStatusCapture(false)],
    path: [bin, "/usr/bin", "/bin"].join(path.delimiter),
  });
  await expect(
    page.getByRole("heading", { name: "Claude isn't available" }),
  ).toBeVisible();
  // The narrowed PATH has no bun, so the worktree list shows an alert of its own.
  const signIn = page
    .getByRole("alert")
    .filter({ hasText: "check your Claude sign-in" });
  await expect(signIn.locator("p")).toHaveText(
    "Alliance agent couldn't check your Claude sign-in. Make sure Claude Code is installed and runs, then check again.",
  );
  await expect(signIn.locator("pre")).toContainText(
    "couldn't find Claude Code. Install Claude Code",
  );
  const checkAgain = page.getByRole("button", { name: "Check again" });
  await expect(checkAgain).toBeFocused();
  await checkAgain.evaluate((button) =>
    button.setAttribute("data-pressed", ""),
  );
  await page.keyboard.down("Enter");
  await expect(
    page.locator("button:not([data-pressed])", { hasText: "Check again" }),
  ).toBeFocused();

  // The stub's shebang needs bun, which the narrowed PATH leaves out.
  const bun = execFileSync("sh", ["-c", "command -v bun"], {
    encoding: "utf8",
  }).trim();
  writeFileSync(
    path.join(bin, "claude"),
    `#!/bin/sh\nsleep 1\nexec "${bun}" "${process.env[claudeExecutableVariable]}" "$@"\n`,
  );
  chmodSync(path.join(bin, "claude"), 0o755);
  await page.keyboard.down("Enter");
  await page.keyboard.up("Enter");
  // The found CLI's check takes a second, so the wait lets a wrong one show.
  await page.waitForTimeout(500);
  await expect(
    page.getByRole("heading", { name: "Claude isn't available" }),
  ).toBeVisible();
  await checkAgain.click();
  await expect(page.getByRole("status")).toBeFocused();
  await expect(
    page.getByRole("heading", { name: "Sign in to Claude" }),
  ).toBeVisible();
  await app.close();
});

test("each agent checks, signs in and cancels on its own, and a saved conversation opens once its own agent signs in", async () => {
  const saved = (agent: AgentKind) => ({
    id: `${agent}-saved`,
    agent,
    title: `Saved on ${agent}`,
    folder: test.info().outputPath("work"),
    startedAt: "2026-11-10T12:00:00.000Z",
  });
  writeConversations(
    JSON.stringify({
      version: 2,
      conversations: [saved(AgentKind.Claude), saved(AgentKind.Codex)],
    }),
  );
  const { app, page } = await launch({ captures: [authStatusCapture(false)] });
  await expect(
    page.getByRole("button", { name: "Sign in to Claude" }),
  ).toBeVisible();
  // Each sign-in waits for the test to finish it, and Resume only records its call.
  await app.evaluate(({ ipcMain }, channel) => {
    const calls: { checks: string[]; resumes: string[] } = {
      checks: [],
      resumes: [],
    };
    const signedIn = new Set<string>();
    const finish: Record<string, (ok: boolean) => void> = {};
    Reflect.set(globalThis, "signInTest", { calls, finish });
    for (const name of [channel.SignInStatus, channel.SignIn, channel.Resume])
      ipcMain.removeHandler(name);
    ipcMain.handle(channel.SignInStatus, (_, agent: string) => {
      calls.checks.push(agent);
      return { ok: true, value: signedIn.has(agent) };
    });
    ipcMain.handle(
      channel.SignIn,
      (_, agent: string) =>
        new Promise((resolve) => {
          finish[agent] = (ok: boolean) => {
            if (ok) signedIn.add(agent);
            resolve(ok ? { ok: true } : { ok: false, error: "Cancelled." });
          };
        }),
    );
    ipcMain.handle(channel.Resume, (_, id: string) => {
      calls.resumes.push(id);
      return { ok: true, value: { turnRunning: false } };
    });
  }, IpcChannel);
  const calls = () =>
    app.evaluate(() => Reflect.get(globalThis, "signInTest").calls);
  const finish = (agent: AgentKind, ok: boolean) =>
    app.evaluate(
      (_, { agent, ok }) =>
        Reflect.get(globalThis, "signInTest").finish[agent](ok),
      { agent, ok },
    );
  const open = (agent: AgentKind) =>
    page
      .getByRole("button", { name: new RegExp(`^Saved on ${agent}`) })
      .click();
  const cancel = page.getByRole("button", { name: "Cancel sign-in" });
  await page.reload();
  await page.getByRole("button", { name: "Sign in to Claude" }).click();
  await expect(cancel).toBeVisible();
  expect(await calls()).toEqual({ checks: [AgentKind.Claude], resumes: [] });

  await open(AgentKind.Codex);
  await page.getByRole("button", { name: "Sign in to Codex" }).click();
  await expect(cancel).toBeVisible();
  await open(AgentKind.Claude);
  await expect(cancel).toBeVisible();
  await cancel.click();
  await finish(AgentKind.Claude, false);
  await expect(
    page.getByRole("button", { name: "Sign in to Claude" }),
  ).toBeVisible();
  await open(AgentKind.Codex);
  await expect(cancel).toBeVisible();

  await open(AgentKind.Claude);
  await finish(AgentKind.Codex, true);
  await expect
    .poll(async () => (await calls()).checks)
    .toEqual([
      AgentKind.Claude,
      AgentKind.Codex,
      AgentKind.Claude,
      AgentKind.Codex,
    ]);
  expect((await calls()).resumes).toEqual([]);
  await open(AgentKind.Codex);
  await expect
    .poll(async () => (await calls()).resumes)
    .toEqual([`${AgentKind.Codex}-saved`]);
  await app.close();
});
