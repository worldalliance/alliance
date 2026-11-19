import { expect, test } from "@playwright/test";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import {
  capturedCheckout,
  captured as codexCaptured,
} from "../src/main/agent/codex/testing/capture";
import { executableVariable } from "../src/main/cli-executable";
import { AgentKind } from "../src/shared/agent-kind";
import type { AgentApi } from "../src/shared/ipc";
import { start } from "./ipc-helpers";
import {
  captured,
  claudeExecutableVariable,
  launch,
  noteOutlivedApp,
  outlivedApp,
  trackedClaude,
  workFolder,
  writeClaude,
} from "./launch";

// page.evaluate callbacks run in the renderer, where the preload defines window.agent.
declare const window: { agent: AgentApi };

const codexVariable = executableVariable(AgentKind.Codex);

/** Writes script as this test's codex, an sh script that runs the stub for anything script doesn't exit on. */
function writeCodex(script: string): string {
  const codex = test.info().outputPath("codex");
  writeFileSync(
    codex,
    `#!/bin/sh\n${script}\nexec "${process.env[codexVariable]}" "$@"\n`,
  );
  chmodSync(codex, 0o755);
  return codex;
}

test("a Codex conversation is saved as Codex's and resumes on Codex after a relaunch", async () => {
  const folder = capturedCheckout(test.info().outputPath("work"));
  const first = await launch({
    captures: [],
    codexCaptures: [codexCaptured("edit-and-interrupt-session")],
  });
  const sessionId = await start(first.page, { agent: AgentKind.Codex, folder });
  await first.app.close();

  const second = await launch({
    captures: [],
    codexCaptures: [codexCaptured("resume-with-image-session")],
  });
  const listed = await second.page.evaluate(() =>
    window.agent.listConversations(),
  );
  expect(
    listed.ok && listed.value.map(({ id, agent }) => ({ id, agent })),
  ).toEqual([{ id: sessionId, agent: AgentKind.Codex }]);
  const resumed = await second.page.evaluate(
    (id) => window.agent.resume(id),
    sessionId,
  );
  expect(resumed.ok).toBe(true);
  await second.app.close();
});

test("cancelling one agent's sign-in leaves the other's running", async () => {
  const claude =
    writeClaude(`[ "$1 $2" = "auth login" ] && touch "$0.started" && exec sleep 30
exec "${process.env[claudeExecutableVariable]}" "$@"
`);
  const codex = writeCodex(`case " $* " in
  *" login status "*) ;;
  *" login "*) touch "$0.started"; exec sleep 30;;
esac`);
  const { app, page } = await launch({
    captures: [],
    claude,
    env: { [codexVariable]: codex },
  });
  const signIn = (agent: AgentKind) =>
    page.evaluate((agent) => window.agent.signIn(agent), agent);
  const claudeSignIn = signIn(AgentKind.Claude);
  const codexSignIn = signIn(AgentKind.Codex);
  await expect.poll(() => existsSync(`${claude}.started`)).toBe(true);
  await expect.poll(() => existsSync(`${codex}.started`)).toBe(true);

  await page.evaluate(
    (agent) => window.agent.cancelSignIn(agent),
    AgentKind.Codex,
  );
  expect((await codexSignIn).ok).toBe(false);
  expect(
    await Promise.race([
      claudeSignIn.then(() => "ended"),
      setTimeout(500, "running"),
    ]),
  ).toBe("running");

  await page.evaluate(
    (agent) => window.agent.cancelSignIn(agent),
    AgentKind.Claude,
  );
  expect((await claudeSignIn).ok).toBe(false);
  await app.close();
});

test("quitting waits for a Codex app-server whose setup failed to exit", async () => {
  const codex = writeCodex(`case " $* " in
  *" app-server "*)
    read -r initialize
    echo '{"id":1,"error":{"code":-32603,"message":"refused"}}'
    cat > /dev/null
    sleep 1
    ${noteOutlivedApp}
    exit 0;;
esac`);
  const { app, page } = await launch({
    captures: [],
    env: { [codexVariable]: codex },
  });
  const started = await page.evaluate((input) => window.agent.start(input), {
    folder: capturedCheckout(test.info().outputPath("work")),
    firstMessage: "Hello",
    agent: AgentKind.Codex,
  });
  expect(started.ok).toBe(false);
  const closed = app.waitForEvent("close");
  await app.evaluate(({ app }) => app.quit());
  await closed;
  await setTimeout(1_500);
  expect(outlivedApp(codex)).toBe(false);
});

test("quitting waits for a session that finishes starting while a failed Codex setup's app-server exits", async () => {
  const gate = (name: string) => test.info().outputPath(name);
  const waitFor = (name: string) =>
    `while [ ! -e "${gate(name)}" ]; do kill -0 $PPID 2>/dev/null || exit 1; sleep 0.05; done`;
  const reached = (name: string) =>
    expect.poll(() => existsSync(gate(name)), { timeout: 10_000 }).toBe(true);
  const codex = writeCodex(`case " $* " in
  *" app-server "*)
    read -r initialize
    echo '{"id":1,"error":{"code":-32603,"message":"refused"}}'
    cat > /dev/null
    ${waitFor("codex-exit")}
    ${noteOutlivedApp}
    exit 0;;
esac`);
  const claude = trackedClaude();
  writeFileSync(
    claude,
    readFileSync(claude, "utf8").replace(
      "#!/bin/sh\n",
      `#!/bin/sh\nif [ "$1" = --version ]; then touch "${gate("checking")}"; ${waitFor("release")}; fi\n`,
    ),
  );
  const { app, page } = await launch({
    captures: [captured("edit-and-interrupt-session")],
    claude,
    env: { [codexVariable]: codex, ALLIANCE_AGENT_OPENING_WAIT_MS: "500" },
  });
  const failed = await page.evaluate((input) => window.agent.start(input), {
    folder: workFolder(),
    firstMessage: "Hello",
    agent: AgentKind.Codex,
  });
  expect(failed.ok).toBe(false);
  const late = page.evaluate((input) => window.agent.start(input), {
    folder: workFolder(),
    firstMessage: "Hello",
    agent: AgentKind.Claude,
  });
  await reached("checking");
  const closed = app.waitForEvent("close");
  await app.evaluate(({ app }) => app.quit());
  // Outlasts the opening wait, so the quit is waiting only on the failed setup's app-server.
  await setTimeout(1_000);
  writeFileSync(gate("release"), "");
  expect(await late).toEqual({
    ok: false,
    error: "Alliance agent is quitting.",
  });
  writeFileSync(gate("codex-exit"), "");
  await closed;
  await setTimeout(1_500);
  expect(outlivedApp(codex)).toBe(false);
  expect(outlivedApp(claude)).toBe(false);
});
