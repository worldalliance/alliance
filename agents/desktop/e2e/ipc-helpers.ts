import { type Page } from "@playwright/test";
import { AgentEventKind } from "../src/shared/agent-event";
import { type AgentApi } from "../src/shared/ipc";
import { workFolder } from "./launch";

// page.evaluate callbacks run in the renderer, where the preload defines window.agent.
declare const window: { agent: AgentApi };

export const firstMessage = "Change hello to goodbye in a.txt";

/** Resolves to the started conversation's id once its first turn ends. */
export async function start(page: Page): Promise<string> {
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
      input: { folder: workFolder(), firstMessage },
      turnEnded: AgentEventKind.TurnEnded,
    },
  );
  if (!started.ok) throw new Error(started.error);
  return started.value.id;
}
