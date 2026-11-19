// Runs the thin path against the real, signed-in Codex through the adapter, checks it, and saves the redacted traffic as captures.
// Usage, from agents/desktop: bun src/main/agent/codex/testing/capture-codex.ts
// ALLIANCE_AGENT_CODEX_EXECUTABLE names the codex to run when the one on PATH is a wrapper, such as a terminal's shim.
import { copyFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { R } from "../../../../../../../common/src/result";
import { AgentKind } from "../../../../shared/agent-kind";
import { findExecutable } from "../../../cli-executable";
import { devCodexHome } from "../../../dev-app-data";
import { readCapture } from "../../testing/capture-record";
import {
  appData,
  captureScratch,
  check,
  checkTranscriptUploaded,
  machine,
  repo,
  runScriptedTask,
  writeCaptures,
} from "../../testing/capture-run";
import { isSignedInToCodex, signInToCodex } from "../auth";
import { createCodexBackend } from "../backend";
import { checkCodexVersion, type CodexCli } from "../process";
import { CODEX_VERSION } from "../version";
import { capturedHooks, captureDir } from "./capture";
import { redactCapture } from "./redact";

const { scratch, recordDir } = captureScratch("codex-capture");
const workFile = path.join(scratch, "a.txt");
const home = devCodexHome(appData);
writeFileSync(workFile, "hello\n");
// The private config holds only the trust the adapter writes, so removing it makes the run trust the repository from scratch, keeping the sign-in.
rmSync(path.join(home, "config.toml"), { force: true });

const realCodex = R.unwrap(
  findExecutable({ agent: AgentKind.Codex, env: process.env, packaged: false }),
);
const real: CodexCli = { executable: realCodex, home };
const recorded: CodexCli = {
  executable: fileURLToPath(
    new URL("../../testing/record-cli.ts", import.meta.url),
  ),
  home,
};
process.env.ALLIANCE_AGENT_RECORD_REAL = realCodex;
process.env.ALLIANCE_AGENT_RECORD_DIR = recordDir;

R.unwrap(await checkCodexVersion(real));
if (!R.unwrap(await isSignedInToCodex(real))) {
  console.log(`Signing in to Codex in ${home}; finish in the browser.`);
  R.unwrap(await signInToCodex(real));
  check(R.unwrap(await isSignedInToCodex(real)), "signed in after codex login");
}

const firstId = await runScriptedTask({
  createBackend: () => createCodexBackend(recorded),
  workFile,
  editWith: "a shell command",
});

console.log("resume a thread that doesn't exist");
process.env.ALLIANCE_AGENT_RECORD_NAME = "missing-thread";
const missing = await createCodexBackend(recorded).resume({
  cwd: repo,
  sessionId: "019a0000-0000-7000-8000-000000000000",
});
check(
  !missing.ok && /no rollout found/.test(missing.error.message),
  "resuming a missing thread fails",
);

// The repository's Stop hook is its transcript upload, which Codex runs only once the adapter has trusted it.
const stopHookRuns = readdirSync(recordDir)
  .filter((file) => file.endsWith("-session.jsonl"))
  .flatMap((file) => readCapture(path.join(recordDir, file)))
  .filter(
    (record) =>
      "text" in record &&
      record.text.includes('"method":"hook/completed"') &&
      record.text.includes('"eventName":"stop"') &&
      record.text.includes('"status":"completed"'),
  );
check(stopHookRuns.length > 0, "the repository's Stop hook ran");

writeCaptures({
  recordDir,
  files: readdirSync(recordDir),
  out: captureDir(CODEX_VERSION),
  redact: (content) =>
    redactCapture(content, {
      ...machine,
      hostname: hostname(),
      tmpdir: tmpdir(),
    }),
});
copyFileSync(
  path.join(machine.mainCheckout, ".codex", "hooks.json"),
  capturedHooks,
);

// Last, so a run without a working transcript login still writes its captures.
checkTranscriptUploaded(`codex/${firstId}.jsonl`);
