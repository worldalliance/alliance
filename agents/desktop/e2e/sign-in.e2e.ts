import { expect, type Locator, test } from "@playwright/test";
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
import { claudeExecutableVariable } from "../src/main/claude-executable";
import { authStatusCapture, launch, writeTestCapture } from "./launch";

/** Runs the stub, except where script, a shell snippet seeing the CLI's arguments, exits first. */
function wrapClaude(script: string): string {
  const claude = test.info().outputPath("claude");
  writeFileSync(
    claude,
    `#!/bin/sh\n${script}\nexec "${process.env[claudeExecutableVariable]}" "$@"\n`,
  );
  chmodSync(claude, 0o755);
  return claude;
}

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
        `[ "$2" = login ] && touch "${signedIn}" && trap '' TERM && sleep 1 && exit 0`,
        `[ "$2" = status ] && [ -e "${signedIn}" ] && echo '{"loggedIn":true}' && exit 0`,
      ].join("\n"),
    ),
  });
  await page.getByRole("button", { name: "Sign in to Claude" }).click();
  await page.getByRole("button", { name: "Cancel sign-in" }).click();
  await expect(page.getByRole("heading")).toHaveCount(0);
  await expect(page).toHaveTitle("Alliance agent");
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
  const centre = async (button: Locator) => {
    const box = await button.boundingBox();
    if (!box) throw new Error("button not rendered");
    return [box.x + box.width / 2, box.y + box.height / 2] as const;
  };
  const started = () => readdirSync(logins).length;
  await signIn.click();
  await expect.poll(started).toBe(1);
  await page.mouse.click(...(await centre(cancel)));
  await expect(signIn).toBeFocused();
  await page.mouse.move(...(await centre(signIn)));
  await page.mouse.down({ clickCount: 2 });
  await page.mouse.up({ clickCount: 2 });
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
  await expect(page.getByRole("heading")).toHaveCount(0);
  await expect(page).toHaveTitle("Alliance agent");
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

test("a signed-out user is asked to sign in before starting", async () => {
  const { app, page } = await launch({ captures: [authStatusCapture(false)] });
  await expect(
    page.getByRole("heading", { name: "Sign in to Claude" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in to Claude" }),
  ).toBeVisible();
  await expect(page).toHaveTitle("Sign in to Claude – Alliance agent");
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
  await expect(page.getByRole("alert").locator("p")).toHaveText(
    "Alliance agent couldn't check your Claude sign-in. Make sure Claude Code is installed and runs, then check again.",
  );
  await expect(page.getByRole("alert").locator("pre")).toContainText(
    "couldn't find Claude Code. Install Claude Code",
  );
  const checkAgain = page.getByRole("button", { name: "Check again" });
  await expect(checkAgain).toBeFocused();
  await expect(page).toHaveTitle("Claude isn't available – Alliance agent");
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
