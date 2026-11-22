import { expect, type Page, test } from "@playwright/test";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { git } from "../src/main/repository/testing/fixture";
import { steeringFile } from "../src/main/tasks/testing/fixture";
import { send, status } from "./chat-helpers";
import {
  authStatusCapture,
  captured,
  codexLoginStatusCapture,
  launch,
  workFolder,
} from "./launch";

const request = "Change hello to goodbye in a.txt";
const taskFolder = () =>
  test.info().outputPath("alliance-change-hello-to-goodbye-in-a-txt");

async function repositoryReady(page: Page) {
  await expect(
    page.getByRole("button", { name: /^Alliance repository/ }),
  ).toContainText("Ready");
}

// Creating a task, then its first turn, outlasts the default timeout on a loaded machine.
const firstTurnDone = (page: Page) =>
  expect(status(page)).toHaveText("Claude finished.", { timeout: 15_000 });

const taskEntry = (page: Page, title = request) =>
  page.getByRole("navigation").getByRole("button", { name: title }).first();

test("a new task shows its setup, then its first conversation running in its own worktree", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  await repositoryReady(page);
  await expect(page.getByRole("heading", { name: "New task" })).toBeVisible();
  const hold = steeringFile(workFolder(), "fake-hold");
  writeFileSync(hold, "");
  await send(page, request);
  await expect(page.getByRole("heading", { name: request })).toBeVisible();
  await expect(status(page)).toHaveText("Setting up: Copying the database…");
  await expect(status(page)).toBeFocused();
  await expect(taskEntry(page)).toContainText("Copying the database…");
  await expect(page.getByText(request)).toHaveCount(2);

  rmSync(hold);
  await firstTurnDone(page);
  await expect(page.locator(".user")).toHaveText(request);
  await expect(taskEntry(page)).toContainText("Ready");
  const nested = page.getByRole("navigation").locator("ul.nested button");
  await expect(nested).toHaveText(/Change hello.*Claude/);
  expect(git(taskFolder(), "branch", "--show-current")).toBe(
    "change-hello-to-goodbye-in-a-txt",
  );

  await taskEntry(page).click();
  await expect(page.getByText(taskFolder())).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "New conversation in this task" }),
  ).toBeVisible();
  await expect(
    page.getByText("Claude works in this task's folder."),
  ).toBeVisible();
  await app.close();
});

test("a window reloaded while a task is set up shows the task once it is", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  await repositoryReady(page);
  const hold = steeringFile(workFolder(), "fake-hold");
  writeFileSync(hold, "");
  await send(page, request);
  await expect(status(page)).toHaveText("Setting up: Copying the database…");
  await page.reload();
  await taskEntry(page).click();
  await expect(status(page)).toHaveText("Setting up: Copying the database…");

  rmSync(hold);
  await expect(
    page.getByRole("heading", { name: "New conversation in this task" }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(taskFolder())).toBeVisible();
  await expect(taskEntry(page)).toHaveAttribute("aria-current", "page");
  await app.close();
});

test("a task that couldn't be created keeps its request, says what it left, and can be tried again or edited", async () => {
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
    "Alliance agent couldn't set up the task's own copy.",
  );
  await expect(
    page.getByText(`Part of it was created: ${taskFolder()}.`, {
      exact: false,
    }),
  ).toBeVisible();
  await expect(page.locator(".request")).toHaveText(request);
  await expect(taskEntry(page)).toContainText("Couldn't be created");
  await expect(page.getByRole("button", { name: "Try again" })).toBeFocused();

  await page.getByRole("button", { name: "Edit request" }).click();
  await expect(page.getByRole("heading", { name: "New task" })).toBeVisible();
  await expect(page.getByLabel("Message Codex")).toHaveValue(request);
  await expect(taskEntry(page)).toHaveText(
    `${request}Not finished being created`,
  );

  rmSync(fail);
  await page.getByRole("radio", { name: "Claude" }).check();
  await page.getByLabel("Message Claude").press("Enter");
  await firstTurnDone(page);
  expect(existsSync(`${taskFolder()}-2`)).toBe(true);
  await app.close();
});

test("a worktree made outside the app shows marked", async () => {
  const { app, page } = await launch({ captures: [authStatusCapture(true)] });
  await repositoryReady(page);
  const outside = test.info().outputPath("by-hand");
  git(workFolder(), "worktree", "add", "-q", "-b", "by-hand", outside);
  await app.evaluate(({ app }) => app.emit("browser-window-focus"));
  await expect(taskEntry(page, "by-hand")).toContainText(
    "Ready · Made outside Alliance agent",
  );
  await app.close();
});

test("a worktree made from inside a task nests under it", async () => {
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
  await app.close();
});
