import { expect, type Page, test } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { constants, openSync, rmSync } from "node:fs";
import { AgentEventKind } from "../src/shared/agent-event";
import { AgentKind } from "../src/shared/agent-kind";
import type { AgentApi } from "../src/shared/ipc";
import { workFolder } from "./launch";

// page.evaluate callbacks run in the renderer, where the preload defines window.agent.
declare const window: { agent: AgentApi };

export const firstMessage = "Change hello to goodbye in a.txt";

/** Resolves to the started conversation's id once its first turn ends. */
export async function start(
  page: Page,
  on = { agent: AgentKind.Claude, folder: workFolder() },
): Promise<string> {
  const started = await page.evaluate(
    async ({ input, turnEnded }) => {
      const ended = new Promise<void>((resolve) => {
        window.agent.onEvent(({ event }) => {
          if (event.kind === turnEnded) resolve();
        });
      });
      const result = await window.agent.start(input);
      if (result.ok) await ended;
      return result;
    },
    {
      input: { ...on, firstMessage },
      turnEnded: AgentEventKind.TurnEnded,
    },
  );
  if (!started.ok) throw new Error(started.error);
  return started.value.id;
}

/** Replaces the saved conversation list with a FIFO once any read already under way has finished, so the next read waits until the test writes the list. */
export async function holdNextListRead(
  page: Page,
): Promise<() => Promise<number>> {
  await expect(page.locator("#root main")).toBeAttached();
  await page.evaluate(() => window.agent.listConversations());
  const list = test.info().outputPath("user-data", "conversations.json");
  rmSync(list, { force: true });
  execFileSync("mkfifo", [list]);
  // Opening the FIFO without blocking fails until a read has it open.
  const openFifo = () => {
    try {
      return openSync(list, constants.O_WRONLY | constants.O_NONBLOCK);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENXIO")
        return undefined;
      throw error;
    }
  };
  return async () => {
    let fifo = openFifo();
    while (fifo === undefined) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      fifo = openFifo();
    }
    return fifo;
  };
}
