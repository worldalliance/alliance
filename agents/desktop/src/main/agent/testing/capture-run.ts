import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { constants, homedir } from "node:os";
import path from "node:path";
import { type AgentEvent, AgentEventKind } from "../../../shared/agent-event";
import type { Machine } from "./redact-lines";

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

export const replyText = (events: AgentEvent[]) =>
  events
    .flatMap((e) => (e.kind === AgentEventKind.AssistantText ? [e.text] : []))
    .join("");

export const deltaText = (events: AgentEvent[]) =>
  events
    .flatMap((e) =>
      e.kind === AgentEventKind.AssistantTextDelta ? [e.text] : [],
    )
    .join("");

export const redPng = Buffer.from(
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
