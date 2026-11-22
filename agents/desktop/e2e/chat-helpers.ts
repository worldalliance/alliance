import {
  type ElectronApplication,
  expect,
  type Page,
  test,
} from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { claudeExecutableVariable, workFolder, writeClaude } from "./launch";

export async function chooseFolder(app: ElectronApplication, folder: string) {
  await app.evaluate(({ dialog }, chosen) => {
    Object.assign(dialog, {
      showOpenDialog: () =>
        Promise.resolve({ canceled: false, filePaths: [chosen] }),
    });
  }, folder);
}

export async function send(page: Page, text: string) {
  await page.getByLabel("Message Claude").fill(text);
  await page.getByLabel("Message Claude").press("Enter");
}

export const status = (page: Page) => page.getByRole("status");

/** Opens Ask without a task once the test's repository is ready in workFolder. */
export async function askWithoutTask(page: Page) {
  await expect(
    page.getByRole("button", { name: /^Alliance repository/ }),
  ).toContainText("Ready");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Ask without a task" })
    .click();
  await expect(page.getByText(workFolder())).toBeVisible();
}

export async function finishFirstTurn(page: Page) {
  await askWithoutTask(page);
  await send(page, "Change hello to goodbye in a.txt");
  await expect(status(page)).toHaveText("Claude finished.");
}

/** Holds the version check, and so every start, until release is called. */
export function heldClaude(): { claude: string; release: () => void } {
  const released = test.info().outputPath("released");
  const claude = writeClaude(
    `[ "$1" = --version ] && while [ ! -e "${released}" ]; do sleep 0.05; done\nexec "${process.env[claudeExecutableVariable]}" "$@"\n`,
  );
  return { claude, release: () => writeFileSync(released, "") };
}

export function writeConversations(contents: string) {
  const userData = test.info().outputPath("user-data");
  mkdirSync(userData, { recursive: true });
  writeFileSync(path.join(userData, "conversations.json"), contents);
}

export function saveConversation(folder: string, id = "saved") {
  writeConversations(
    JSON.stringify({
      version: 1,
      conversations: [
        {
          id,
          folder,
          title: "Saved",
          startedAt: "2026-11-10T12:00:00.000Z",
        },
      ],
    }),
  );
}
