import { expect, type Page, test } from "@playwright/test";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  capturedHooks,
  captured as codexCaptured,
  stdinShape,
} from "../src/main/agent/codex/testing/capture";
import {
  CaptureRecordKind,
  readCapture,
} from "../src/main/agent/testing/capture-record";
import { executableVariable } from "../src/main/cli-executable";
import { AgentKind } from "../src/shared/agent-kind";
import { askWithoutWorktree, status } from "./chat-helpers";
import {
  authStatusCapture,
  codexLoginStatusCapture,
  launch,
  testRepository,
  writeTestCapture,
} from "./launch";

const codexRepository = () =>
  testRepository({
    ".codex/hooks.json": readFileSync(capturedHooks, "utf8"),
  });

const box = (page: Page) => page.getByLabel("Message Codex");

async function sendToCodex(page: Page, text: string) {
  await box(page).fill(text);
  await box(page).press("Enter");
}

const codexVariable = executableVariable(AgentKind.Codex);

/** A codex that runs login, given its CODEX_HOME, in place of the stub, and reports signed in once a login has finished. */
function codexSigningIn(login: string): string {
  const signedIn = test.info().outputPath("codex-signed-in");
  const codex = test.info().outputPath("codex");
  writeFileSync(
    codex,
    `#!/bin/sh
case " $* " in
  *" login status "*) [ -e "${signedIn}" ] && echo 'Logged in using ChatGPT' >&2 && exit 0
    echo 'Not logged in' >&2; exit 1;;
  *" login "*) ${login}
    touch "${signedIn}"; exit 0;;
esac
exec "${process.env[codexVariable]}" "$@"
`,
  );
  chmodSync(codex, 0o755);
  return codex;
}

test("a Codex conversation streams replies, shows tool calls, stops, and resumes after a relaunch", async () => {
  codexRepository();
  const first = await launch({
    captures: [authStatusCapture(true)],
    codexCaptures: [
      codexLoginStatusCapture(true),
      codexCaptured("edit-and-interrupt-session"),
    ],
  });
  const { page } = first;

  await askWithoutWorktree(page);
  await expect(page.getByRole("radio", { name: "Claude" })).toBeChecked();
  await page.getByRole("radio", { name: "Codex" }).check();
  await expect(page.getByText(/^Codex works in the main copy/)).toBeVisible();
  await sendToCodex(page, "Change hello to goodbye in a.txt");
  await expect(status(page)).toHaveText("Codex finished.");
  await expect(page.locator(".tool")).toHaveCount(2);
  await expect(page.locator(".tool").first()).toContainText("command");
  await expect(page.locator(".tool").first()).toContainText("Done");
  await expect(page.locator(".assistant").last()).toHaveText(
    "Replaced `hello` with `goodbye` in `.scratch/codex-capture/a.txt`.",
  );
  await expect(page.locator(".items > li").last()).toHaveText(/^Codex: /);
  await expect(page.getByRole("navigation")).toContainText("Codex · work");

  await sendToCodex(page, "Count to 300, one number per line");
  await expect(page.locator(".assistant").last()).toContainText("1\n2\n3");
  await expect(status(page)).toHaveText("Codex is working…");
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByText("You stopped this reply.")).toBeVisible();
  await expect(status(page)).toHaveText("Stopped.");

  await sendToCodex(page, "Reply with pong");
  await expect(page.locator(".assistant").last()).toHaveText("pong");
  await expect(status(page)).toHaveText("Codex finished.");
  await first.app.close();

  const second = await launch({
    captures: [authStatusCapture(true)],
    codexCaptures: [
      codexLoginStatusCapture(true),
      codexCaptured("resume-with-image-session"),
    ],
  });
  await second.page
    .getByRole("button", { name: /Change hello to goodbye in a\.txt/ })
    .click();
  await expect(
    second.page.getByText(
      "Earlier messages in this conversation aren't shown here yet. Codex still remembers them.",
    ),
  ).toBeVisible();
  await sendToCodex(second.page, "Which word did you reply with?");
  await expect(second.page.locator(".assistant")).toHaveText("pong");
  await expect(status(second.page)).toHaveText("Codex finished.");
  await second.app.close();
});

test("a Codex conversation whose app-server exits before reading its first message moves it to a new Codex conversation", async () => {
  const [start, ...records] = readCapture(
    codexCaptured("edit-and-interrupt-session"),
  );
  const firstTurn = records.findIndex(
    (record) =>
      record.kind === CaptureRecordKind.In &&
      stdinShape(record.text).startsWith("turn/start "),
  );
  if (start?.kind !== CaptureRecordKind.Start || firstTurn < 0)
    throw new Error("the capture has no start record or no turn/start");
  const unreading = writeTestCapture({
    name: "unreading-codex",
    args: start.args,
    records: [
      ...records.slice(0, firstTurn),
      { kind: CaptureRecordKind.Exit, code: 1 },
    ],
  });
  codexRepository();
  const { app, page } = await launch({
    captures: [authStatusCapture(true)],
    codexCaptures: [codexLoginStatusCapture(true), unreading],
  });
  await askWithoutWorktree(page);
  await page.getByRole("radio", { name: "Codex" }).check();
  await sendToCodex(page, "Hello");
  await expect(
    page.getByText(
      "Codex stopped before reading your first message, so this conversation wasn't kept.",
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Move your message to a new conversation" })
    .click();
  await expect(page.getByRole("radio", { name: "Codex" })).toBeChecked();
  await expect(box(page)).toHaveValue("Hello");
  await app.close();
});

test("each agent signs in on its own, a signed-out agent's conversation waits for its sign-in, and the next new conversation starts on Claude", async () => {
  codexRepository();
  const first = await launch({
    captures: [authStatusCapture(true)],
    codexCaptures: [
      codexLoginStatusCapture(true),
      codexCaptured("edit-and-interrupt-session"),
    ],
  });
  await askWithoutWorktree(first.page);
  await first.page.getByRole("radio", { name: "Codex" }).check();
  await sendToCodex(first.page, "Change hello to goodbye in a.txt");
  await expect(status(first.page)).toHaveText("Codex finished.");
  await first.page
    .getByRole("button", { name: "Ask without a worktree" })
    .click();
  await expect(first.page.getByRole("radio", { name: "Claude" })).toBeChecked();
  await expect(first.page.getByLabel("Message Claude")).toBeVisible();
  await first.app.close();

  const { app, page } = await launch({
    captures: [authStatusCapture(true)],
    codexCaptures: [codexLoginStatusCapture(false)],
  });
  await expect(page.getByLabel("Message Claude")).toBeVisible();
  await page
    .getByRole("button", { name: /Change hello to goodbye in a\.txt/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "Sign in to Codex" }),
  ).toBeVisible();
  await expect(
    page.getByText("Alliance agent uses your own ChatGPT subscription."),
  ).toBeVisible();
  await expect(box(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Ask without a worktree" }).click();
  await expect(page.getByRole("radio", { name: "Claude" })).toBeChecked();
  await expect(page.getByLabel("Message Claude")).toBeVisible();
  await page.getByRole("radio", { name: "Codex" }).check();
  await expect(
    page.getByRole("button", { name: "Sign in to Codex" }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: "Codex" })).toBeFocused();
  await app.close();
});

test("Sign in to Codex runs codex login in the app's own CODEX_HOME, then offers the message box", async () => {
  const home = test.info().outputPath("codex-home");
  const { app, page } = await launch({
    captures: [authStatusCapture(true)],
    env: { [codexVariable]: codexSigningIn(`echo "$CODEX_HOME" > "${home}"`) },
  });
  await page.getByRole("radio", { name: "Codex" }).check();
  await page.getByRole("button", { name: "Sign in to Codex" }).click();
  await expect(box(page)).toBeVisible();
  expect(readFileSync(home, "utf8").trim()).toBe(
    test.info().outputPath("user-data", "codex"),
  );
  await app.close();
});

test("cancelling Codex's sign-in stops codex login", async () => {
  const started = test.info().outputPath("login-started");
  const { app, page } = await launch({
    captures: [authStatusCapture(true)],
    env: {
      [codexVariable]: codexSigningIn(`touch "${started}"; exec sleep 30`),
    },
  });
  await page.getByRole("radio", { name: "Codex" }).check();
  await page.getByRole("button", { name: "Sign in to Codex" }).click();
  await expect.poll(() => existsSync(started)).toBe(true);
  await page.getByRole("button", { name: "Cancel sign-in" }).click();
  await expect(
    page.getByRole("button", { name: "Sign in to Codex" }),
  ).toBeFocused();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await app.close();
});
