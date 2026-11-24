// Runs the thin path against the real, signed-in Codex through the adapter, checks it, and saves the redacted traffic as captures.
// Usage, from agents/desktop: bun src/main/agent/codex/testing/capture-codex.ts
import { copyFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { R } from "../../../../../../../common/src/result";
import { AgentKind } from "../../../../shared/agent-kind";
import { readCapture } from "../../testing/capture-record";
import {
  captureScratch,
  check,
  checkTranscriptUploaded,
  devExecutable,
  devFolders,
  machine,
  repo,
  runScriptedTask,
  writeCaptures,
} from "../../testing/capture-run";
import {
  CodexLogin,
  isSignedInToCodex,
  readCodexLogin,
  signInToCodex,
} from "../auth";
import { createCodexBackend } from "../backend";
import { withCodexHomeLock } from "../home-lock";
import { checkCodexVersion, type CodexCli } from "../process";
import { CODEX_VERSION } from "../version";
import { capturedHooks, captureDir } from "./capture";
import { redactCapture } from "./redact";

const { scratch, recordDir } = captureScratch("codex-capture");
const workFile = path.join(scratch, "a.txt");
const folders = devFolders(scratch);
const home = folders.codexHome;
writeFileSync(workFile, "hello\n");

const realCodex = devExecutable(AgentKind.Codex);
const real: CodexCli = { executable: realCodex, folders };
// The private config holds only the trust the adapter writes, so removing it makes the run trust the repository from scratch, keeping the sign-in.
R.unwrap(
  await withCodexHomeLock({ cli: real }, async () =>
    R.success(rmSync(path.join(home, "config.toml"), { force: true })),
  ),
);
const recorded: CodexCli = {
  executable: fileURLToPath(
    new URL("../../testing/record-cli.ts", import.meta.url),
  ),
  folders,
};
process.env.ALLIANCE_AGENT_RECORD_REAL = realCodex;
process.env.ALLIANCE_AGENT_RECORD_DIR = recordDir;

R.unwrap(await checkCodexVersion(real));
// OpenAI recommends an API key for automation, such as a recording in CI.
const recordsOn: Record<CodexLogin, boolean> = {
  [CodexLogin.ChatGpt]: true,
  [CodexLogin.ApiKey]: true,
  [CodexLogin.OtherCredential]: false,
  [CodexLogin.SignedOut]: false,
};
if (!recordsOn[R.unwrap(await readCodexLogin(real))]) {
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
const missingBackend = createCodexBackend(recorded);
const missing = await missingBackend.resume({
  cwd: repo,
  sessionId: "019a0000-0000-7000-8000-000000000000",
});
// Its capture ends with the exit record only once that CLI has exited.
await missingBackend.settled();
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
