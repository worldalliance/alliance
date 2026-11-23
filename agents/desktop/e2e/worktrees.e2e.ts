import { expect, test } from "@playwright/test";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { git } from "../src/main/repository/testing/fixture";
import { steeringFile } from "../src/main/worktrees/testing/fixture";
import { send, status } from "./chat-helpers";
import {
  authStatusCapture,
  captured,
  codexLoginStatusCapture,
  launch,
  workFolder,
} from "./launch";
import {
  archived,
  firstTurnDone,
  repositoryReady,
  request,
  worktreeEntry,
  worktreeFolder,
} from "./worktree-helpers";

test("a new worktree shows its setup, then its first conversation running in its folder", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  await repositoryReady(page);
  await expect(
    page.getByRole("heading", { name: "New worktree" }),
  ).toBeVisible();
  const hold = steeringFile(workFolder(), "fake-hold");
  writeFileSync(hold, "");
  await send(page, request);
  await expect(page.getByRole("heading", { name: request })).toBeVisible();
  await expect(status(page)).toHaveText("Setting up: Copying the database…");
  await expect(status(page)).toBeFocused();
  await expect(worktreeEntry(page)).toContainText("Copying the database…");
  await expect(page.getByText(request)).toHaveCount(2);

  rmSync(hold);
  await firstTurnDone(page);
  await expect(page.locator(".user")).toHaveText(request);
  await expect(worktreeEntry(page)).toContainText("Ready");
  const nested = page.getByRole("navigation").locator("ul.nested button");
  await expect(nested).toHaveText(/Change hello.*Claude/);
  expect(git(worktreeFolder(), "branch", "--show-current")).toBe(
    "change-hello-to-goodbye-in-a-txt",
  );

  await worktreeEntry(page).click();
  await expect(page.getByText(worktreeFolder())).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "New conversation in this worktree" }),
  ).toBeVisible();
  await expect(
    page.getByText("Claude works in this worktree's folder."),
  ).toBeVisible();
  await app.close();
});

test("a window reloaded while a worktree is set up shows the worktree once it is", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  await repositoryReady(page);
  const hold = steeringFile(workFolder(), "fake-hold");
  writeFileSync(hold, "");
  await send(page, request);
  await expect(status(page)).toHaveText("Setting up: Copying the database…");
  await page.reload();
  await worktreeEntry(page).click();
  await expect(status(page)).toHaveText("Setting up: Copying the database…");

  rmSync(hold);
  await expect(
    page.getByRole("heading", { name: "New conversation in this worktree" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(worktreeFolder())).toBeVisible();
  await expect(worktreeEntry(page)).toHaveAttribute("aria-current", "page");
  await app.close();
});

test("a worktree that couldn't be created keeps its request, says what it left, and can be tried again or edited, and Restore on its leftover focuses Archive", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
    codexCaptures: [codexLoginStatusCapture(true)],
  });
  await repositoryReady(page);
  const fail = steeringFile(workFolder(), "fake-fail");
  writeFileSync(fail, "");
  await page.getByRole("radio", { name: "Codex" }).check();
  await page.getByLabel("Message Codex").fill(request);
  await page.getByLabel("Message Codex").press("Enter");
  await expect(page.getByRole("alert")).toContainText(
    "Alliance agent couldn't create the worktree.",
  );
  await expect(
    page.getByText(`Part of it was created: ${worktreeFolder()}.`, {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.locator(".request")).toHaveText(request);
  await expect(worktreeEntry(page)).toContainText("Couldn't be created");
  await expect(page.getByRole("button", { name: "Try again" })).toBeFocused();

  await page.getByRole("button", { name: "Edit request" }).click();
  await expect(
    page.getByRole("heading", { name: "New worktree" }),
  ).toBeVisible();
  await expect(page.getByLabel("Message Codex")).toHaveValue(request);
  await expect(worktreeEntry(page)).toHaveText(
    `${request}Not finished being created`,
  );

  rmSync(fail);
  await page.getByRole("radio", { name: "Claude" }).check();
  await page.getByLabel("Message Claude").press("Enter");
  await firstTurnDone(page);
  expect(existsSync(`${worktreeFolder()}-2`)).toBe(true);

  await page
    .getByRole("navigation")
    .getByRole("button")
    .filter({ hasText: "Not finished being created" })
    .click();
  await page.getByRole("button", { name: "Archive" }).click();
  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("button", { name: "Archive" })).toBeFocused();
  await app.close();
});

test("archiving a worktree hides it with its conversations until restored, which focuses its message box, and a worktree made outside the app shows marked", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  await repositoryReady(page);
  await send(page, request);
  await firstTurnDone(page);
  const outside = test.info().outputPath("by-hand");
  git(workFolder(), "worktree", "add", "-q", "-b", "by-hand", outside);
  await app.evaluate(({ app }) => app.emit("browser-window-focus"));
  await expect(worktreeEntry(page, "by-hand")).toContainText(
    "Ready · Made outside Alliance agent",
  );

  await worktreeEntry(page).click();
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Archived. Its folder, branch, databases and conversations are kept, and it still uses disk space.",
  );
  const sidebar = page.getByRole("navigation");
  await expect(sidebar.locator("ul.nested")).toHaveCount(0);
  await expect(sidebar.getByText("Archived (1)")).toBeVisible();
  await expect(worktreeEntry(page)).toContainText("Ready");
  await expect(sidebar.getByText("Other conversations")).toBeVisible();
  await expect(sidebar.getByText(/^Change hello.*Claude ·/)).toHaveCount(0);
  expect(existsSync(worktreeFolder())).toBe(true);

  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByRole("button", { name: "Archive" })).toBeVisible();
  await expect(page.getByLabel("Message Claude")).toBeFocused();
  await expect(sidebar.locator("ul.nested button")).toHaveCount(1);
  await sidebar.locator("ul.nested button").click();
  await expect(page.locator(".user")).toHaveText(request);
  await app.close();
});

test("a worktree made from inside another nests under it until that one is archived", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  await repositoryReady(page);
  await send(page, request);
  await firstTurnDone(page);
  const inner = test.info().outputPath("alliance-inner");
  git(workFolder(), "worktree", "add", "-q", "-b", "inner", inner);
  writeFileSync(
    path.join(steeringFile(workFolder(), "fake-records"), "alliance-inner"),
    JSON.stringify({
      id: "id-inner",
      name: "inner",
      state: "recorded",
      parent: "id-change-hello-to-goodbye-in-a-txt",
    }),
  );
  await app.evaluate(({ app }) => app.emit("browser-window-focus"));
  const sidebar = page.getByRole("navigation");
  await expect(
    sidebar.locator("ul.nested").getByRole("button", { name: /^inner/ }),
  ).toBeVisible();

  await worktreeEntry(page).click();
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(archived(page)).toBeVisible();
  await expect(sidebar.locator("ul.nested")).toHaveCount(0);
  await expect(worktreeEntry(page, "inner")).toContainText("Ready");
  await app.close();
});
