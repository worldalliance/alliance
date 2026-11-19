import { afterEach, expect, test } from "bun:test";
import {
  existsSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { R } from "../../../../../../common/src/result";
import { CaptureRecordKind } from "../testing/capture-record";
import {
  checkCodexVersion,
  codexConfigArgs,
  codexEnvironment,
  runCodex,
} from "./process";
import { captured } from "./testing/capture";
import { replay, stopReplay, stubCli, writeCapture } from "./testing/stub";

afterEach(stopReplay);

test("the environment keeps Codex's root certificate, drops its and OpenAI's other settings and the Claude credentials, and sets the private home", () => {
  expect(
    codexEnvironment("/home/codex", {
      PATH: "/bin",
      HOME: "/home/user",
      CODEX_HOME: "/elsewhere",
      CODEX_API_KEY: "[redacted]",
      CODEX_THREAD_ID: "parent",
      CODEX_CA_CERTIFICATE: "/certs/proxy.pem",
      OPENAI_API_KEY: "[redacted]",
      OPENAI_BASE_URL: "https://example.com",
      ANTHROPIC_API_KEY: "[redacted]",
      ANTHROPIC_AUTH_TOKEN: "[redacted]",
      CLAUDE_CODE_OAUTH_TOKEN: "[redacted]",
      CLAUDE_CONFIG_DIR: "/kept",
    }),
  ).toEqual({
    PATH: "/bin",
    HOME: "/home/user",
    CLAUDE_CONFIG_DIR: "/kept",
    CODEX_CA_CERTIFICATE: "/certs/proxy.pem",
    CODEX_HOME: "/home/codex",
  });
});

test("a run creates the private home, open only to the user, runs in its environment and passes the overrides first", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "codex-run-test-"));
  const executable = path.join(dir, "codex");
  writeFileSync(
    executable,
    '#!/bin/sh\nprintf \'%s\\n\' "$CODEX_HOME" "${OPENAI_API_KEY-unset}" "$@"\n',
    { mode: 0o755 },
  );
  const home = path.join(dir, "home");
  const key = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "[redacted]";
  try {
    const run = await runCodex({ executable, home }, { args: ["login"] });
    expect(R.map(run, (exited) => exited.stdout.split("\n"))).toEqual(
      R.success([home, "unset", ...codexConfigArgs, "login", ""]),
    );
    expect(statSync(home).mode & 0o777).toBe(0o700);
  } finally {
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a run that can't create the private home fails without running Codex", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "codex-run-test-"));
  const executable = path.join(dir, "codex");
  const ran = path.join(dir, "ran");
  writeFileSync(executable, `#!/bin/sh\ntouch '${ran}'\n`, { mode: 0o755 });
  writeFileSync(path.join(dir, "file"), "");
  const home = path.join(dir, "file", "home");
  try {
    const run = await runCodex({ executable, home }, { args: ["login"] });
    expect(run.ok ? "" : run.error.message).toStartWith(
      `Alliance agent couldn't create Codex's folder ${home}:`,
    );
    expect(existsSync(ran)).toBe(false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the pinned version passes the version check", async () => {
  replay(captured("version"));
  expect(await checkCodexVersion(stubCli)).toEqual(R.success(undefined));
});

test("another version fails the version check, naming both", async () => {
  replay(
    writeCapture([
      { kind: CaptureRecordKind.Start, args: ["--version"] },
      { kind: CaptureRecordKind.StdinClosed },
      { kind: CaptureRecordKind.Out, text: "codex-cli 0.1.0" },
      { kind: CaptureRecordKind.Exit, code: 0 },
    ]),
  );
  const checked = await checkCodexVersion(stubCli);
  expect(checked.ok ? "" : checked.error.message).toEndWith(
    "is Codex 0.1.0, but Alliance agent supports only 0.167.0",
  );
});
