import { expect, type Page, test } from "@playwright/test";
import { mkdirSync, renameSync } from "node:fs";
import type { RepositorySource } from "../src/main/repository/source";
import { testSourceVariable } from "../src/main/repository/source";
import {
  commitFile,
  git,
  makeSource,
} from "../src/main/repository/testing/fixture";
import { commitWorktreeScripts } from "../src/main/tasks/testing/fixture";
import type { AgentApi } from "../src/shared/ipc";
import { chooseFolder } from "./chat-helpers";
import { authStatusCapture, launch } from "./launch";

// page.evaluate callbacks run in the renderer, where the preload defines window.agent.
declare const window: { agent: AgentApi };

// With working worktree scripts, so the sidebar lists tasks rather than a listing failure.
function fixtureSource(): RepositorySource {
  const source = makeSource({
    folder: test.info().outputPath("source"),
    defaultFolder: test.info().outputPath("workspaces", "alliance"),
  });
  return { ...source, minimumCommit: commitWorktreeScripts(source.url) };
}

const launchWith = (source: RepositorySource, captures: string[] = []) =>
  launch({
    captures: [authStatusCapture(true), ...captures],
    env: { [testSourceVariable]: JSON.stringify(source) },
  });

const entry = (page: Page) =>
  page.getByRole("button", { name: /^Alliance repository/ });

test("a fresh machine clones into the default folder, and conversations without a task start there", async () => {
  const source = fixtureSource();
  const { app, page } = await launchWith(source);
  await expect(entry(page)).toContainText("Ready");
  await page.getByRole("button", { name: "Ask without a task" }).click();
  await expect(page.getByText(source.defaultFolder)).toBeVisible();
  expect(git(source.defaultFolder, "rev-parse", "HEAD")).toBe(
    source.minimumCommit,
  );

  await entry(page).click();
  await expect(page).toHaveTitle("Alliance repository – Alliance agent");
  await expect(
    page.getByText("Agents work on their own copy of this for each task."),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Ready.");
  await app.close();
});

test("a copy chosen with Use existing copy is kept across launches", async () => {
  const source = fixtureSource();
  mkdirSync(source.defaultFolder, { recursive: true });
  git(source.defaultFolder, "init", "-q");
  const chosen = test.info().outputPath("mine");
  git(test.info().outputPath(), "clone", "-q", source.url, chosen);

  const first = await launchWith(source);
  await entry(first.page).click();
  await expect(first.page.getByRole("main").getByRole("alert")).toContainText(
    "already has other files in it",
  );
  await chooseFolder(first.app, chosen);
  await first.page.getByRole("button", { name: "Use existing copy…" }).click();
  await expect(first.page.getByRole("status")).toHaveText("Ready.");
  await expect(first.page.getByText(chosen)).toBeVisible();
  await first.app.close();

  const second = await launchWith(source);
  await expect(entry(second.page)).toContainText("Ready");
  await second.page.getByRole("button", { name: "Ask without a task" }).click();
  await expect(second.page.getByText(chosen)).toBeVisible();
  await second.app.close();
});

test("a saved copy that can't be found is looked for again with Check again", async () => {
  const source = fixtureSource();
  mkdirSync(source.defaultFolder, { recursive: true });
  git(source.defaultFolder, "init", "-q");
  const chosen = test.info().outputPath("mine");
  git(test.info().outputPath(), "clone", "-q", source.url, chosen);
  const first = await launchWith(source);
  await entry(first.page).click();
  await chooseFolder(first.app, chosen);
  await first.page.getByRole("button", { name: "Use existing copy…" }).click();
  await expect(first.page.getByText(chosen)).toBeVisible();
  await first.app.close();

  const moved = test.info().outputPath("moved");
  renameSync(chosen, moved);
  const { app, page } = await launchWith(source);
  await entry(page).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "is gone",
  );
  renameSync(moved, chosen);
  await page.getByRole("button", { name: "Check again" }).click();
  await expect(page.getByRole("status")).toHaveText("Ready.");
  await expect(page.getByText(chosen)).toBeVisible();
  await app.close();
});

test("a folder in another repository says it isn't the Alliance repository", async () => {
  const source = fixtureSource();
  const plain = test.info().outputPath("plain");
  mkdirSync(plain);
  git(plain, "init", "-q");
  commitFile({ folder: plain, file: "README", message: "Other" });
  const { app, page } = await launchWith(source);
  await expect(entry(page)).toContainText("Ready");
  await entry(page).click();
  await chooseFolder(app, plain);
  await page.getByRole("button", { name: "Use existing copy…" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    `${plain} is a copy of another repository, not the Alliance repository.`,
  );
  await app.close();
});

test("a folder picker that fails to open says so, and a canceled one changes nothing", async () => {
  const source = fixtureSource();
  const { app, page } = await launchWith(source);
  await expect(entry(page)).toContainText("Ready");
  await app.evaluate(({ dialog }) => {
    Object.assign(dialog, {
      showOpenDialog: () => Promise.reject(new Error("No display")),
    });
  });
  expect(
    await page.evaluate(() => window.agent.useExistingRepository()),
  ).toEqual({
    ok: true,
    value: {
      message: "Alliance agent couldn't open the folder picker.",
      details: "No display",
    },
  });

  await app.evaluate(({ dialog }) => {
    Object.assign(dialog, {
      showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] }),
    });
  });
  expect(await page.evaluate(() => window.agent.changeCloneFolder())).toEqual({
    ok: true,
  });
  await entry(page).click();
  await expect(page.getByRole("status")).toHaveText("Ready.");
  await expect(page.getByText(source.defaultFolder)).toBeVisible();
  await app.close();
});

test("an outdated copy on main updates once the user confirms", async () => {
  const source = fixtureSource();
  git(
    test.info().outputPath(),
    "clone",
    "-q",
    source.url,
    source.defaultFolder,
  );
  git(source.defaultFolder, "reset", "-q", "--hard", source.firstCommit);
  const { app, page } = await launchWith(source);
  await expect(entry(page)).toContainText("Update needed");
  await entry(page).click();
  await page
    .getByRole("button", { name: "Update to the latest main…" })
    .click();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Ready.");
  expect(git(source.defaultFolder, "rev-parse", "HEAD")).toBe(
    source.minimumCommit,
  );
  await app.close();
});

test("an outdated copy on another branch says what to do instead of updating", async () => {
  const source = fixtureSource();
  git(
    test.info().outputPath(),
    "clone",
    "-q",
    source.url,
    source.defaultFolder,
  );
  git(source.defaultFolder, "reset", "-q", "--hard", source.firstCommit);
  git(source.defaultFolder, "checkout", "-q", "-b", "feature");
  const { app, page } = await launchWith(source);
  await entry(page).click();
  await expect(
    page.getByText(
      "This copy is on the branch feature. Switch it to main, then check again.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Update/ })).toHaveCount(0);
  git(source.defaultFolder, "checkout", "-q", "main");
  git(source.defaultFolder, "merge", "-q", "--ff-only", "origin/main");
  await page.getByRole("button", { name: "Check again" }).click();
  await expect(page.getByRole("status")).toHaveText("Ready.");
  await app.close();
});

test("a clone that fails says why and can be tried again", async () => {
  const source = { ...fixtureSource(), url: test.info().outputPath("gone") };
  const { app, page } = await launchWith(source);
  await expect(entry(page)).toContainText("Needs attention");
  await entry(page).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "couldn't clone the repository",
  );
  await page.getByText("Details").click();
  await expect(
    page.getByRole("main").getByRole("alert").locator("pre"),
  ).toContainText("git clone exited");
  await expect(page.getByRole("button", { name: "Clone" })).toBeVisible();
  await app.close();
});
