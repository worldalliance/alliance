// Runs the thin path against the real, signed-in Claude Code through the adapter, checks it, and saves the redacted traffic as captures.
// Usage, from agents/desktop: bun src/main/agent/claude/testing/capture-claude.ts
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { R } from "../../../../../../../common/src/result";
import { AgentEventKind } from "../../../../shared/agent-event";
import { devClaudeConfigDir } from "../../../dev-app-data";
import { ImageMediaType } from "../../session";
import {
  appData,
  captureScratch,
  check,
  checkTranscriptUploaded,
  deltaText,
  machine,
  redPng,
  replyText,
  repo,
  writeCaptures,
} from "../../testing/capture-run";
import { kinds, onFifthDelta, text, turn } from "../../testing/turn";
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

const realClaude = execFileSync("which", ["claude"], {
  encoding: "utf8",
}).trim();
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

console.log("edit, interrupt and a turn after it");
process.env.ALLIANCE_AGENT_RECORD_NAME = "edit-and-interrupt";
const first = R.unwrap(
  await createClaudeBackend(recorded).start({ cwd: repo }),
);
const edit = await turn({
  session: first,
  message: text(
    `Use the Edit tool to change the word hello to goodbye in ${path.relative(repo, workFile)}, then reply with one short sentence.`,
  ),
});
check(
  readFileSync(workFile, "utf8").includes("goodbye"),
  "the file was edited",
);
check(
  [
    AgentEventKind.ToolStarted,
    AgentEventKind.ToolFinished,
    AgentEventKind.AssistantTextDelta,
    AgentEventKind.AssistantText,
  ].every((k) => kinds(edit).includes(k)),
  "the edit turn streamed text and called a tool",
);
check(
  !kinds(edit).includes(AgentEventKind.Error),
  "the edit turn had no error",
);
const interrupted = await turn({
  session: first,
  message: text("Count from 1 to 300, one number per line. Use no tools."),
  onEvent: onFifthDelta(() => first.interrupt()),
});
check(
  !kinds(interrupted).includes(AgentEventKind.Error),
  "an interrupt emits no error",
);
check(
  !/\b300\b/.test(deltaText(interrupted)),
  "the interrupt cut the turn short",
);
const pong = await turn({
  session: first,
  message: text("Reply with just the word: pong"),
});
check(/pong/i.test(replyText(pong)), "the session answers after an interrupt");
await first.close();

console.log("resume in a new backend, as after an app restart, with an image");
process.env.ALLIANCE_AGENT_RECORD_NAME = "resume-with-image";
const resumed = R.unwrap(
  await createClaudeBackend(recorded).resume({
    cwd: repo,
    sessionId: first.id,
  }),
);
const recalled = await turn({
  session: resumed,
  message: text(
    "Which word did you reply with in your previous message? Reply with just that word.",
  ),
});
check(
  /pong/i.test(replyText(recalled)),
  "the resumed session remembers the last turn",
);
const image = await turn({
  session: resumed,
  message: {
    text: "What colour is this image? Reply with one word.",
    images: [{ mediaType: ImageMediaType.Png, data: redPng }],
  },
});
check(/red/i.test(replyText(image)), "the image arrived");
await resumed.close();

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
checkTranscriptUploaded(`claude/${first.id}.jsonl`);
