import { afterEach, expect, test } from "bun:test";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { R } from "../../../../../../common/src/result";
import { AgentKind } from "../../../shared/agent-kind";
import { agentEnvironment } from "../agent-environment";
import { writeAgentLaunchers } from "../agent-launchers";
import { devExecutable } from "../testing/capture-run";

let dir: string;
let server: ReturnType<typeof Bun.serve> | undefined;
afterEach(() => {
  void server?.stop(true);
  rmSync(dir, { recursive: true, force: true });
});

const sse = (events: { type: string; [key: string]: unknown }[]) =>
  new Response(
    events
      .map(
        (event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
      )
      .join(""),
    { headers: { "content-type": "text/event-stream" } },
  );

const completed = (id: string) => ({
  type: "response.completed",
  response: {
    id,
    usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
  },
});

const request = z.object({
  input: z.array(
    z.looseObject({
      type: z.string().optional(),
      output: z.unknown().optional(),
    }),
  ),
});

/** A model, in the Responses API's streaming format, that asks for one command through Codex's exec_command tool, then records what Codex sends back. */
function mockModel(command: string) {
  const { promise: output, resolve } = Promise.withResolvers<unknown>();
  server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: async (incoming) => {
      if (!new URL(incoming.url).pathname.endsWith("/responses"))
        return new Response(null, { status: 404 });
      const body = request.parse(await incoming.json());
      const output = body.input.find(
        (item) => item.type === "function_call_output",
      );
      if (output) {
        resolve(output.output);
        return sse([completed("second")]);
      }
      return sse([
        { type: "response.created", response: { id: "first" } },
        {
          type: "response.output_item.done",
          item: {
            type: "function_call",
            call_id: "call",
            name: "exec_command",
            arguments: JSON.stringify({ cmd: command, yield_time_ms: 10_000 }),
          },
        },
        completed("first"),
      ]);
    },
  });
  return { url: `http://127.0.0.1:${server.port}/v1`, output };
}

const executable = (file: string, body: string) => {
  writeFileSync(file, `#!/bin/sh\n${body}\n`);
  chmodSync(file, 0o755);
};

test("a command a Codex session runs finds the app's launchers ahead of a claude and codex the user's shell profile puts first on PATH", async () => {
  dir = mkdtempSync(path.join(tmpdir(), "codex-shell-path-test-"));
  const home = path.join(dir, "home");
  const userBin = path.join(dir, "user-bin");
  const work = path.join(dir, "work");
  for (const folder of [home, userBin, work]) mkdirSync(folder);
  for (const name of ["claude", "codex"])
    executable(path.join(userBin, name), "echo the user's own");
  // The profiles a login shell reads, as Homebrew's installer suggests; macOS's /etc/zprofile reorders PATH the same way.
  for (const profile of [".zprofile", ".bash_profile", ".profile"])
    writeFileSync(path.join(home, profile), `export PATH="${userBin}:$PATH"\n`);
  const folders = {
    claudeConfigDir: path.join(dir, "claude"),
    codexHome: path.join(dir, "codex"),
    bin: path.join(dir, "bin"),
  };
  const claude = path.join(dir, "bundled-claude");
  executable(claude, "true");
  R.unwrap(
    writeAgentLaunchers({
      folders,
      claude: R.success(claude),
      codex: R.success(devExecutable(AgentKind.Codex)),
    }),
  );
  const model = mockModel("command -v claude codex");
  const run = Bun.spawn(
    [
      path.join(folders.bin, "codex"),
      "exec",
      "--skip-git-repo-check",
      "--sandbox",
      "danger-full-access",
      "-c",
      'model_provider="mock"',
      "-c",
      `model_providers.mock={name="mock",base_url=${JSON.stringify(model.url)},wire_api="responses",requires_openai_auth=false,supports_websockets=false}`,
      "Run the command.",
    ],
    {
      cwd: work,
      stdin: "ignore",
      stdout: "ignore",
      stderr: "pipe",
      timeout: 50_000,
      env: agentEnvironment(folders, {
        HOME: home,
        PATH: ["/usr/bin", "/bin"].join(path.delimiter),
      }),
    },
  );
  const stderr = new Response(run.stderr).text();
  // Codex syncs its plugin catalogue before it exits, which can take tens of seconds, so the test ends once the command's output arrives.
  const output = await Promise.race([model.output, run.exited]);
  run.kill();
  await run.exited;
  expect(String(output), await stderr).toContain(
    `\n${path.join(folders.bin, "claude")}\n${path.join(folders.bin, "codex")}\n`,
  );
}, 60_000);
