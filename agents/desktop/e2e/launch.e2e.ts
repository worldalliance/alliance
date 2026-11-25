import { expect, test } from "@playwright/test";
import { start } from "./ipc-helpers";
import {
  captured,
  launch,
  outlivedApp,
  runningCount,
  trackedClaude,
} from "./launch";

test("a CLI that outlives its killed app is noted", async () => {
  const claude = trackedClaude();
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
    claude,
  });
  await start(page);
  app.process().kill("SIGKILL");
  await expect.poll(() => runningCount(claude)).toBe(0);
  expect(outlivedApp(claude)).toBe(true);
});
