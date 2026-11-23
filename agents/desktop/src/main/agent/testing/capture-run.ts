import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { constants, homedir } from "node:os";
import path from "node:path";
import { R } from "../../../../../../common/src/result";
import { type AgentEvent, AgentEventKind } from "../../../shared/agent-event";
import type { AgentKind } from "../../../shared/agent-kind";
import { findExecutable } from "../../cli-executable";
import { type AgentBackend, ImageMediaType } from "../session";
import type { Machine } from "./redact-lines";
import { kinds, onFifthDelta, text, turn } from "./turn";

export const repo = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();

/** Electron's appData, which takes any non-empty XDG_CONFIG_HOME, a relative one included. */
export const appData =
  process.platform === "darwin"
    ? path.join(homedir(), "Library/Application Support")
    : process.env.XDG_CONFIG_HOME
      ? path.resolve(process.env.XDG_CONFIG_HOME)
      : path.join(homedir(), ".config");

/** The CLI a development build bundles, or the one its variable names. */
export const devExecutable = (agent: AgentKind): string =>
  R.unwrap(
    findExecutable({
      agent,
      env: process.env,
      packaged: false,
      root: path.join(import.meta.dirname, "../../../.."),
      platform: process.platform,
      arch: process.arch,
    }),
  );

/** A fresh scratch folder for one capture run, with recordDir for its raw recordings, removed when the run ends, since those hold what redaction removes. */
export function captureScratch(name: string): {
  scratch: string;
  recordDir: string;
} {
  const scratch = path.join(repo, ".scratch", name);
  rmSync(scratch, { recursive: true, force: true });
  // A signal skips exit handlers unless it is turned into an exit.
  process.on("exit", () => rmSync(scratch, { recursive: true, force: true }));
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const)
    process.on(signal, () => process.exit(128 + constants.signals[signal]));
  const recordDir = path.join(scratch, "raw");
  mkdirSync(recordDir, { recursive: true });
  return { scratch, recordDir };
}

export const machine: Machine = {
  repo,
  // The CLIs also print the main checkout's path when recording from a worktree.
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

export function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(`check failed: ${message}`);
}

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

/** Redacts every recording, then replaces out's parent folder, every other version's captures included, with out holding them, so a failed redaction leaves the committed captures as they were. A recording named `<name>-version.jsonl` becomes version.jsonl. */
export function writeCaptures(params: {
  recordDir: string;
  files: string[];
  out: string;
  redact: (content: string) => string;
}): void {
  const captures = params.files.map((file) => ({
    target: file.endsWith("-version.jsonl") ? "version.jsonl" : file,
    content: params.redact(
      readFileSync(path.join(params.recordDir, file), "utf8"),
    ),
  }));
  rmSync(path.dirname(params.out), { recursive: true, force: true });
  mkdirSync(params.out, { recursive: true });
  for (const { target, content } of captures)
    writeFileSync(path.join(params.out, target), content);
  console.log(`captures written to ${params.out}`);
}

/** Fetches the uploaded transcript under key, failing when the repository's upload hook didn't store it, unless ALLIANCE_AGENT_CHATS is off. */
export function checkTranscriptUploaded(key: string): void {
  if (process.env.ALLIANCE_AGENT_CHATS === "off") {
    console.log("transcript upload skipped: ALLIANCE_AGENT_CHATS is off");
    return;
  }
  console.log("transcript upload");
  execFileSync("bun", ["agents/chats/chats.ts", "fetch", key], {
    cwd: repo,
    stdio: ["ignore", "ignore", "inherit"],
  });
}

/** The task every adapter's capture run performs, recording each backend's traffic under its own name: an edit in workFile, an interrupted turn and one after it, then a resume in a new backend, as after an app restart, with an image. Returns the first session's id. */
export async function runScriptedTask(params: {
  createBackend: () => AgentBackend;
  workFile: string;
  editWith: string;
}): Promise<string> {
  console.log("edit, interrupt and a turn after it");
  process.env.ALLIANCE_AGENT_RECORD_NAME = "edit-and-interrupt";
  const first = R.unwrap(await params.createBackend().start({ cwd: repo }));
  const edit = await turn({
    session: first,
    message: text(
      `Use ${params.editWith} to change the word hello to goodbye in ${path.relative(repo, params.workFile)}, then reply with one short sentence.`,
    ),
  });
  check(
    readFileSync(params.workFile, "utf8").includes("goodbye"),
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
  const ended = interrupted.at(-1);
  check(
    ended?.kind === AgentEventKind.TurnEnded && ended.interrupted,
    "the turn ended as interrupted",
  );
  check(
    !/\b300\b/.test(deltaText(interrupted)),
    "the interrupt cut the turn short",
  );
  const pong = await turn({
    session: first,
    message: text("Reply with just the word: pong"),
  });
  check(
    /pong/i.test(replyText(pong)),
    "the session answers after an interrupt",
  );
  await first.close();

  console.log(
    "resume in a new backend, as after an app restart, with an image",
  );
  process.env.ALLIANCE_AGENT_RECORD_NAME = "resume-with-image";
  const resumed = R.unwrap(
    await params.createBackend().resume({ cwd: repo, sessionId: first.id }),
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
  return first.id;
}
