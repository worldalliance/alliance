import { _electron as electron, expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { packagedApp } from "../scripts/packaged-app";
import { SavedKind, SavedRepository } from "../src/main/repository/saved";
import { showAsk } from "./chat-helpers";

test("a packaged app runs the CLIs it bundles with neither on PATH", async () => {
  const home = test.info().outputPath("home");
  const userData = test.info().outputPath("user-data");
  // A saved clone folder stops the automatic clone. On macOS the app's home folder is the account's, whatever HOME says, so an empty default folder there would be cloned into.
  const cloneFolder = test.info().outputPath("clone-folder");
  mkdirSync(cloneFolder);
  expect(
    await new SavedRepository(path.join(userData, "repository.json")).write({
      kind: SavedKind.CloneFolder,
      folder: cloneFolder,
    }),
  ).toEqual({ ok: true, value: undefined });
  const app = await electron.launch({
    executablePath: packagedApp.executable,
    args: [`--user-data-dir=${userData}`],
    env: {
      HOME: home,
      PATH: ["/usr/bin", "/bin"].join(path.delimiter),
      // A real login shell's profile would put its own PATH back.
      SHELL: path.join(import.meta.dirname, "profile-free-shell"),
      ALLIANCE_AGENT_HEADLESS: "1",
      ...(process.env.DISPLAY && { DISPLAY: process.env.DISPLAY }),
      ...(process.env.XAUTHORITY && { XAUTHORITY: process.env.XAUTHORITY }),
    },
  });
  const page = await app.firstWindow();
  await showAsk(page);
  // Each agent's sign-in check runs its CLI, so each panel shows only once the bundled CLI ran.
  await expect(
    page.getByRole("heading", { name: "Sign in to Claude" }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Codex" }).check();
  await expect(
    page.getByRole("heading", { name: "Sign in to Codex" }),
  ).toBeVisible();
  await app.close();
});
