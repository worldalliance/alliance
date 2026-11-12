// Runs the thin path against the real, signed-in Claude Code through the adapter, checks it, and saves the redacted traffic as captures.
// Usage, from agents/desktop: bun src/main/agent/claude/testing/capture-claude.ts
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { constants, homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { R } from "../../../../../../../common/src/result";
import { type AgentEvent, AgentEventKind, ImageMediaType } from "../../session";
import { isSignedInToClaude, signInToClaude } from "../auth";
import { createClaudeBackend } from "../backend";
import { type ClaudeCli, checkClaudeVersion } from "../process";
import { CLAUDE_CODE_VERSION } from "../protocol";
import { captureDir } from "./capture";
import { redactCapture } from "./redact";
import { onFifthDelta, text, turn } from "./turn";

const repo = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();
const scratch = path.join(repo, ".scratch/claude-capture");
const recordDir = path.join(scratch, "raw");
const workFile = path.join(scratch, "a.txt");
const xdgConfigHome = process.env.XDG_CONFIG_HOME;
// The XDG Base Directory spec treats an empty or relative XDG_CONFIG_HOME as unset.
const configDir =
  process.platform === "darwin"
    ? path.join(homedir(), "Library/Application Support/Alliance agent/claude")
    : path.join(
        xdgConfigHome && path.isAbsolute(xdgConfigHome)
          ? xdgConfigHome
          : path.join(homedir(), ".config"),
        "Alliance agent/claude",
      );

rmSync(scratch, { recursive: true, force: true });
// The raw recordings hold what redaction removes, so no run leaves them behind, failed, interrupted or not. A signal skips exit handlers unless it is turned into an exit.
process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const)
  process.on(signal, () => process.exit(128 + constants.signals[signal]));
mkdirSync(recordDir, { recursive: true });
writeFileSync(workFile, "hello\n");

const realClaude = execFileSync("which", ["claude"], {
  encoding: "utf8",
}).trim();
const real: ClaudeCli = { executable: realClaude, configDir };
const recorded: ClaudeCli = {
  executable: fileURLToPath(new URL("./record-claude.ts", import.meta.url)),
  configDir,
};
process.env.ALLIANCE_AGENT_CLAUDE_REAL = realClaude;
process.env.ALLIANCE_AGENT_CLAUDE_RECORD_DIR = recordDir;

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(`check failed: ${message}`);
}

const kinds = (events: AgentEvent[]) => new Set(events.map((e) => e.kind));
const replyText = (events: AgentEvent[]) =>
  events
    .flatMap((e) => (e.kind === AgentEventKind.AssistantText ? [e.text] : []))
    .join("");
const deltaText = (events: AgentEvent[]) =>
  events
    .flatMap((e) =>
      e.kind === AgentEventKind.AssistantTextDelta ? [e.text] : [],
    )
    .join("");

const redPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGP4z8BAEiJN9aiG0VBiGEpJAwCQ+f8B0adKSwAAAABJRU5ErkJggg==",
  "base64",
);

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
process.env.ALLIANCE_AGENT_CLAUDE_RECORD_NAME = "edit-and-interrupt";
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
  ].every((k) => kinds(edit).has(k)),
  "the edit turn streamed text and called a tool",
);
check(!kinds(edit).has(AgentEventKind.Error), "the edit turn had no error");
const interrupted = await turn({
  session: first,
  message: text("Count from 1 to 300, one number per line. Use no tools."),
  onEvent: onFifthDelta(() => first.interrupt()),
});
check(
  !kinds(interrupted).has(AgentEventKind.Error),
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
process.env.ALLIANCE_AGENT_CLAUDE_RECORD_NAME = "resume-with-image";
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
process.env.ALLIANCE_AGENT_CLAUDE_RECORD_NAME = "missing-session";
const missing = R.unwrap(
  await createClaudeBackend(recorded).resume({
    cwd: repo,
    sessionId: randomUUID(),
  }),
);
const failed = await turn({ session: missing, message: text("Hello") });
check(
  kinds(failed).has(AgentEventKind.Error),
  "a missing session reports an error",
);
await missing.close();

const machine = {
  repo,
  // The CLI also prints the main checkout's path when recording from a worktree.
  mainCheckout: path.dirname(
    execFileSync(
      "git",
      ["rev-parse", "--path-format=absolute", "--git-common-dir"],
      { encoding: "utf8" },
    ).trim(),
  ),
  home: homedir(),
  account: path.basename(homedir()),
};
const out = captureDir(CLAUDE_CODE_VERSION);
// The CLI reports a missing session as it starts, so where that record falls against the first send is a race.
const captures = readdirSync(recordDir)
  .filter((name) => !name.startsWith("missing-session"))
  .map((file) => ({
    target: file.endsWith("-version.jsonl") ? "version.jsonl" : file,
    content: redactCapture(
      readFileSync(path.join(recordDir, file), "utf8"),
      machine,
    ),
  }));
rmSync(path.dirname(out), { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const { target, content } of captures)
  writeFileSync(path.join(out, target), content);
console.log(`captures written to ${out}`);

// Last, so a run without the chats bucket's keys still writes its captures.
if (process.env.ALLIANCE_AGENT_CHATS === "off") {
  console.log("transcript upload skipped: ALLIANCE_AGENT_CHATS is off");
} else {
  console.log("transcript upload");
  execFileSync(
    "bun",
    ["agents/chats/chats.ts", "fetch", `claude/${first.id}.jsonl`],
    {
      cwd: repo,
      stdio: ["ignore", "ignore", "inherit"],
    },
  );
}
