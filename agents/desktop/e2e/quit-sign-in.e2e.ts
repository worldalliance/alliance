import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { AgentKind } from "../src/shared/agent-kind";
import type { AgentApi } from "../src/shared/ipc";
import { firstMessage } from "./ipc-helpers";
import {
  captured,
  claudeExecutableVariable,
  launch,
  runningCount,
  workFolder,
  writeClaude,
} from "./launch";

// page.evaluate callbacks run in the renderer, where the preload defines window.agent.
declare const window: { agent: AgentApi };

const authCalls: Record<string, (agent: AgentKind) => Promise<unknown>> = {
  login: (agent) => window.agent.signIn(agent),
  status: (agent) => window.agent.signedIn(agent),
};

for (const [command, call] of Object.entries(authCalls))
  test(`quitting during claude auth ${command} stops its CLI and waits for it to exit`, async () => {
    const claude = writeClaude(`if [ "$2" = ${command} ]; then
  started=$(date +%s)
  trap 'kill $!; stopped=$(($(date +%s) - started)); sleep 1; echo $stopped > "$0.stopped-after"; exit 0' TERM
  touch "$0.started"
  sleep 30 & wait $!
fi
exec "${process.env[claudeExecutableVariable]}" "$@"
`);
    const { app, page } = await launch({ captures: [], claude });
    void page.evaluate(call, AgentKind.Claude).catch(() => undefined);
    await expect.poll(() => existsSync(`${claude}.started`)).toBe(true);
    const closed = app.waitForEvent("close");
    await app.evaluate(({ app }) => app.quit());
    await closed;
    // Seconds; a sign-in check's CLI is stopped after 10 s anyway.
    expect(
      Number(readFileSync(`${claude}.stopped-after`, "utf8")),
    ).toBeLessThan(9);
  });

test("quitting waits for a session that finishes starting while a sign-in's CLI still exits", async () => {
  const stub = process.env[claudeExecutableVariable];
  const claude =
    writeClaude(`wait_for() { until [ -e "$0.$1" ]; do sleep 0.1; done; }
case "$1 $2" in
  "auth login")
    trap 'kill $!; touch "$0.sign-in-stopping"; wait_for session-started; sleep 0.5; exit 0' TERM
    touch "$0.started"
    sleep 30 & wait $!
    exit;;
  --version*)
    touch "$0.checking"
    wait_for sign-in-stopping
    # Past the opening wait, so the quit has stopped waiting for sessions still starting.
    sleep 0.5
    exec "${stub}" "$@";;
  auth*) exec "${stub}" "$@";;
esac
touch "$0.session-started"
"${stub}" "$@"
# Outlasts the app's own exit, so a CLI the quit didn't wait for is still running once the app has gone.
sleep 3
`);
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
    claude,
    env: { ALLIANCE_AGENT_OPENING_WAIT_MS: "200" },
  });
  void page
    .evaluate((agent) => window.agent.signIn(agent), AgentKind.Claude)
    .catch(() => undefined);
  await expect.poll(() => existsSync(`${claude}.started`)).toBe(true);
  void page
    .evaluate((input) => window.agent.start(input), {
      folder: workFolder(),
      firstMessage,
      agent: AgentKind.Claude,
    })
    .catch(() => undefined);
  await expect.poll(() => existsSync(`${claude}.checking`)).toBe(true);
  const closed = app.waitForEvent("close");
  await app.evaluate(({ app }) => app.quit());
  await closed;
  expect(existsSync(`${claude}.session-started`)).toBe(true);
  expect(runningCount(claude)).toBe(0);
});
