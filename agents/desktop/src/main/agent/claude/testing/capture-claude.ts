// Runs the thin path against the real, signed-in Claude Code through the adapter, checks it, and saves the redacted traffic as captures.
// Usage, from agents/desktop: bun src/main/agent/claude/testing/capture-claude.ts
import { randomUUID } from "node:crypto";
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { R } from "../../../../../../../common/src/result";
import { AgentEventKind } from "../../../../shared/agent-event";
import { AgentKind } from "../../../../shared/agent-kind";
import { devClaudeConfigDir } from "../../../dev-app-data";
import {
  appData,
  captureScratch,
  check,
  checkTranscriptUploaded,
  devExecutable,
  machine,
  repo,
  runScriptedTask,
  writeCaptures,
} from "../../testing/capture-run";
import { kinds, text, turn } from "../../testing/turn";
import { isSignedInToClaude, signInToClaude } from "../auth";
import { createClaudeBackend } from "../backend";
import { type ClaudeCli, checkClaudeVersion } from "../process";
import { CLAUDE_CODE_VERSION } from "../protocol";
import { captureDir } from "./capture";
import { redactCapture } from "./redact";

const { scratch, recordDir } = captureScratch("claude-capture");
const workFile = path.join(scratch, "a.txt");
const configDir = devClaudeConfigDir(appData);
writeFileSync(workFile, "hello\n");

const realClaude = devExecutable(AgentKind.Claude);
const real: ClaudeCli = { executable: realClaude, configDir };
const recorded: ClaudeCli = {
  executable: fileURLToPath(
    new URL("../../testing/record-cli.ts", import.meta.url),
  ),
  configDir,
};
process.env.ALLIANCE_AGENT_RECORD_REAL = realClaude;
process.env.ALLIANCE_AGENT_RECORD_DIR = recordDir;

R.unwrap(await checkClaudeVersion(real));
if (!R.unwrap(await isSignedInToClaude(real))) {
  console.log(`Signing in to Claude in ${configDir}; finish in the browser.`);
  R.unwrap(await signInToClaude(real));
  check(
    R.unwrap(await isSignedInToClaude(real)),
    "signed in after claude auth login",
  );
}

const firstId = await runScriptedTask({
  createBackend: () => createClaudeBackend(recorded),
  workFile,
  editWith: "the Edit tool",
});

console.log("resume a session that doesn't exist");
process.env.ALLIANCE_AGENT_RECORD_NAME = "missing-session";
const missing = R.unwrap(
  await createClaudeBackend(recorded).resume({
    cwd: repo,
    sessionId: randomUUID(),
  }),
);
const failed = await turn({ session: missing, message: text("Hello") });
check(
  kinds(failed).includes(AgentEventKind.Error),
  "a missing session reports an error",
);
await missing.close();

// The CLI reports a missing session as it starts, so where that record falls against the first send is a race.
writeCaptures({
  recordDir,
  files: readdirSync(recordDir).filter(
    (name) => !name.startsWith("missing-session"),
  ),
  out: captureDir(CLAUDE_CODE_VERSION),
  redact: (content) => redactCapture(content, machine),
});

// Last, so a run without a working transcript login still writes its captures.
checkTranscriptUploaded(`claude/${firstId}.jsonl`);
