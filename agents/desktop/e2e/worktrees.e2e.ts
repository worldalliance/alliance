import { expect, test } from "@playwright/test";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { git } from "../src/main/repository/testing/fixture";
import { steeringFile } from "../src/main/worktrees/testing/fixture";
import { send, status } from "./chat-helpers";
import { authStatusCapture, captured, launch, workFolder } from "./launch";
import {
  archived,
  createWorktree,
  firstTurnDone,
  repositoryReady,
  request,
  startInNewWorktree,
  worktreeEntry,
  worktreeFolder,
  worktreeName,
  worktreeReady,
} from "./worktree-helpers";

test("New worktree creates a worktree by name, shows its setup, then starts no conversation until one is sent in it", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  await repositoryReady(page);
  await expect(
    page.getByRole("heading", { name: "New worktree" }),
  ).toBeVisible();
  const name = page.getByLabel("Name");
  await expect(name).toBeFocused();
  await name.fill(request);
  await expect(
    page.getByText(`Creates the worktree ${worktreeName}`),
  ).toBeVisible();
  const hold = steeringFile(workFolder(), "fake-hold");
  writeFileSync(hold, "");
  await name.press("Enter");
  await expect(page.getByRole("heading", { name: worktreeName })).toBeVisible();
  await expect(status(page)).toHaveText("Setting up: Copying the database…");
  await expect(status(page)).toBeFocused();
  await expect(worktreeEntry(page)).toContainText("Copying the database…");

  rmSync(hold);
  await worktreeReady(page);
  await expect(worktreeEntry(page)).toContainText("Ready");
  await expect(page.getByText(worktreeFolder())).toBeVisible();
  await expect(
    page.getByText("Claude works in this worktree's folder."),
  ).toBeVisible();
  await expect(page.getByRole("navigation").locator("ul.nested")).toHaveCount(
    0,
  );
  expect(git(worktreeFolder(), "branch", "--show-current")).toBe(worktreeName);
  await expect(name).toHaveCount(0);

  await send(page, request);
  await firstTurnDone(page);
  await expect(page.locator(".user")).toHaveText(request);
  const nested = page.getByRole("navigation").locator("ul.nested button");
  await expect(nested).toHaveText(/Change hello.*Claude/);
  await app.close();
});

test("New worktree refuses a name with no letter from a to z or digit until it's corrected", async () => {
  const { app, page } = await launch({ captures: [authStatusCapture(true)] });
  await repositoryReady(page);
  const name = page.getByLabel("Name");
  await name.fill("!!!");
  await page.getByRole("button", { name: "Create worktree" }).click();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toHaveAccessibleDescription(
    /Type a name with at least one letter from a to z or digit\./,
  );
  await expect(page.getByRole("alert")).toHaveText(
    "Type a name with at least one letter from a to z or digit.",
  );
  await expect(
    page.getByRole("heading", { name: "New worktree" }),
  ).toBeVisible();
  await name.fill("fix");
  await expect(name).not.toHaveAttribute("aria-invalid");
  await app.close();
});

test("a window reloaded while a worktree is set up shows the worktree once it is", async () => {
  const { app, page } = await launch({ captures: [authStatusCapture(true)] });
  await repositoryReady(page);
  const hold = steeringFile(workFolder(), "fake-hold");
  writeFileSync(hold, "");
  await createWorktree(page);
  await expect(status(page)).toHaveText("Setting up: Copying the database…");
  await page.reload();
  await worktreeEntry(page).click();
  await expect(status(page)).toHaveText("Setting up: Copying the database…");

  rmSync(hold);
  await worktreeReady(page);
  await expect(page.getByText(worktreeFolder())).toBeVisible();
  await expect(worktreeEntry(page)).toHaveAttribute("aria-current", "page");
  await app.close();
});

test("a worktree that couldn't be created says what it left, and can be tried again or its name edited, and Restore on its leftover focuses Archive", async () => {
  const { app, page } = await launch({ captures: [authStatusCapture(true)] });
  await repositoryReady(page);
  const fail = steeringFile(workFolder(), "fake-fail");
  writeFileSync(fail, "");
  await createWorktree(page);
  await expect(page.getByRole("alert")).toContainText(
    "Alliance agent couldn't create the worktree.",
  );
  await expect(
    page.getByText(`Part of it was created: ${worktreeFolder()}.`, {
      exact: false,
    }),
  ).toBeVisible();
  await expect(worktreeEntry(page)).toContainText("Couldn't be created");
  await expect(page.getByRole("button", { name: "Try again" })).toBeFocused();

  await page.getByRole("button", { name: "Edit name" }).click();
  await expect(
    page.getByRole("heading", { name: "New worktree" }),
  ).toBeVisible();
  await expect(page.getByLabel("Name")).toHaveValue(request);
  await expect(worktreeEntry(page)).toHaveText(
    `${worktreeName}Not finished being created`,
  );

  rmSync(fail);
  await page.getByRole("button", { name: "Create worktree" }).click();
  await worktreeReady(page);
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

test("Edit name keeps a name already typed in New worktree, and the failed creation with it", async () => {
  const { app, page } = await launch({ captures: [authStatusCapture(true)] });
  await repositoryReady(page);
  writeFileSync(steeringFile(workFolder(), "fake-fail"), "");
  await createWorktree(page);
  await expect(page.getByRole("button", { name: "Edit name" })).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "New worktree" })
    .click();
  await page.getByLabel("Name").fill("other");
  await worktreeEntry(page).click();
  await page.getByRole("button", { name: "Edit name" }).click();
  await expect(page.getByLabel("Name")).toHaveValue("other");
  await expect(worktreeEntry(page)).toContainText("Couldn't be created");
  await app.close();
});

test("archiving a worktree hides it with its conversations until restored, which focuses its message box", async () => {
  const { app, page } = await launch({
    captures: [authStatusCapture(true), captured("edit-and-interrupt-session")],
  });
  await repositoryReady(page);
  await startInNewWorktree(page);

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
  await startInNewWorktree(page);
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
