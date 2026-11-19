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

export async function finishFirstTurn(app: ElectronApplication, page: Page) {
  const folder = workFolder();
  await chooseFolder(app, folder);
  await page.getByRole("button", { name: "Choose folder…" }).click();
  await expect(page.getByText(folder)).toBeVisible();
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

export function saveConversation(folder: string) {
  writeConversations(
    JSON.stringify({
      version: 1,
      conversations: [
        {
          id: "saved",
          folder,
          title: "Saved",
          startedAt: "2026-11-10T12:00:00.000Z",
        },
      ],
    }),
  );
}
