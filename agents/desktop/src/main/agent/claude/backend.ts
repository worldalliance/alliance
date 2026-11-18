import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { z } from "zod";
import { R, type Result } from "../../../../../../common/src/result";
import { AgentEventKind } from "../../../shared/agent-event";
import {
  cancelKillAfterMs,
  couldNotStart,
  spawnSessionCli,
} from "../cli-process";
import { SessionListeners } from "../listeners";
import {
  type AgentBackend,
  type AgentEventListener,
  type AgentMessage,
  type AgentSession,
} from "../session";
import { type SessionHooks, sessionRegistry } from "../session-registry";
import {
  checkClaudeVersion,
  type ClaudeCli,
  claudeEnvironment,
} from "./process";
import {
  ClaudeLineKind,
  claudeSessionArgs,
  interruptLine,
  parseClaudeLine,
  userMessageLine,
} from "./protocol";

const stderrTailLength = 4000;

class ClaudeSession implements AgentSession {
  private turn: { interrupted: boolean } | undefined;
  private exited = false;
  private exitMessage = "";
  private closing: Promise<void> | undefined;
  private stderrTail = "";
  readonly id: string;
  readonly firstMessageRead: Promise<boolean>;
  private readonly settleFirstMessageRead: (read: boolean) => void;
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly onClosing: SessionHooks["onClosing"];
  private readonly killAfterMs: number;
  private readonly listeners: SessionListeners;
  private readonly closed: Promise<void>;

  constructor(
    init: SessionHooks & {
      id: string;
      child: ChildProcessWithoutNullStreams;
      killAfterMs: number;
    },
  ) {
    const { id, child } = init;
    this.id = id;
    this.child = child;
    this.onClosing = init.onClosing;
    this.killAfterMs = init.killAfterMs;
    this.listeners = new SessionListeners(id);
    const firstMessageRead = Promise.withResolvers<boolean>();
    this.firstMessageRead = firstMessageRead.promise;
    this.settleFirstMessageRead = firstMessageRead.resolve;
    // Writes to a CLI that has just exited fail with EPIPE; its exit is reported instead.
    child.stdin.on("error", () => undefined);
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      this.stderrTail = (this.stderrTail + chunk).slice(-stderrTailLength);
    });
    createInterface({ input: child.stdout }).on("line", (line) =>
      this.handleLine(line),
    );
    this.closed = new Promise((resolve) =>
      child.once("close", (code, signal) => {
        this.exited = true;
        this.settleFirstMessageRead(false);
        const stderr = this.stderrTail.trim();
        this.exitMessage = `Claude Code exited (${signal ?? `code ${code}`}).${stderr ? `\n${stderr}` : ""}`;
        init.onExit();
        if (this.turn) {
          if (!this.closing)
            this.emitError({ message: this.exitMessage, needsResume: true });
          this.endTurn({ interrupted: this.closing !== undefined });
        }
        resolve();
      }),
    );
  }

  get turnRunning(): boolean {
    return this.turn !== undefined;
  }

  send(message: AgentMessage): Result<void, Error> {
    if (this.turn)
      return R.failure(new Error(`session ${this.id} is mid-turn`));
    this.turn = { interrupted: false };
    if (this.exited || this.closing) {
      const message = this.closing
        ? "This session was closed. Resume it to continue."
        : `${this.exitMessage}\nResume the session to continue.`;
      queueMicrotask(() => {
        this.emitError({ message, needsResume: true });
        this.endTurn({ interrupted: false });
      });
    } else {
      this.child.stdin.write(`${userMessageLine(message)}\n`);
    }
    return R.success(undefined);
  }

  interrupt(): void {
    if (!this.turn || this.turn.interrupted || this.exited) return;
    this.turn.interrupted = true;
    this.child.stdin.write(`${interruptLine(randomUUID())}\n`);
  }

  subscribe(listener: AgentEventListener): () => void {
    return this.listeners.subscribe(listener);
  }

  close(): Promise<void> {
    if (!this.closing) {
      this.closing = this.shutDown();
      this.onClosing(this.closing);
    }
    return this.closing;
  }

  private async shutDown(): Promise<void> {
    if (this.exited) return;
    this.child.stdin.end();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const killAfter = (ms: number) =>
      timers.push(setTimeout(() => this.child.kill("SIGKILL"), ms));
    if (this.turn) {
      // A CLI stopped mid-turn may still send its error result, which a close, like an interrupt, doesn't report.
      this.turn.interrupted = true;
      this.child.kill("SIGTERM");
      killAfter(this.killAfterMs);
    } else {
      timers.push(
        setTimeout(() => {
          this.child.kill("SIGTERM");
          killAfter(cancelKillAfterMs);
        }, this.killAfterMs),
      );
    }
    await this.closed;
    timers.forEach(clearTimeout);
  }

  private handleLine(line: string): void {
    const parsed = parseClaudeLine(line);
    if (!parsed.ok) {
      console.error(`session ${this.id}: ${parsed.error.message}`, line);
      if (this.turn && !this.turn.interrupted)
        this.emitError({
          message: `Claude Code sent output Alliance agent can't read: ${parsed.error.message}`,
          needsResume: false,
        });
      return;
    }
    if (!this.turn) return;
    const claudeLine = parsed.value;
    switch (claudeLine.kind) {
      case ClaudeLineKind.MessageRead:
        this.settleFirstMessageRead(true);
        return;
      case ClaudeLineKind.Events:
        for (const event of claudeLine.events) this.listeners.emit(event);
        return;
      case ClaudeLineKind.TurnEnded:
        if (claudeLine.error && !this.turn.interrupted)
          this.emitError({ message: claudeLine.error, needsResume: false });
        this.endTurn({
          interrupted: this.turn.interrupted && claudeLine.error !== undefined,
        });
        return;
      default:
        throw new Error(`unknown line kind: ${claudeLine satisfies never}`);
    }
  }

  private emitError(error: { message: string; needsResume: boolean }): void {
    this.listeners.emit({ kind: AgentEventKind.Error, ...error });
  }

  private endTurn({ interrupted }: { interrupted: boolean }): void {
    this.turn = undefined;
    this.listeners.emit({ kind: AgentEventKind.TurnEnded, interrupted });
  }
}

export function createClaudeBackend(
  cli: ClaudeCli,
  // Outlasts the repository's SessionEnd transcript upload, whose hook times out after 10 seconds.
  timing = { killAfterMs: 15_000 },
): AgentBackend {
  const sessions = sessionRegistry();
  let versionChecked = false;

  async function launch(
    params: SessionHooks & {
      cwd: string;
      sessionId: string;
      sessionArgs: readonly string[];
    },
  ): Promise<Result<AgentSession, Error>> {
    if (!versionChecked) {
      const checked = await checkClaudeVersion(cli);
      if (!checked.ok) return checked;
      versionChecked = true;
    }
    const child = await spawnSessionCli({
      executable: cli.executable,
      args: [...claudeSessionArgs, ...params.sessionArgs],
      cwd: params.cwd,
      env: claudeEnvironment(cli.configDir),
    });
    if (!child.ok) return child;
    return R.success(
      new ClaudeSession({
        id: params.sessionId,
        child: child.value,
        onClosing: params.onClosing,
        onExit: params.onExit,
        killAfterMs: timing.killAfterMs,
      }),
    );
  }

  const track = (params: {
    cwd: string;
    sessionId: string;
    sessionArgs: readonly string[];
  }) =>
    sessions.launch(params.sessionId, (hooks) =>
      launch({ ...params, ...hooks }).catch((error: unknown) =>
        couldNotStart({ executable: cli.executable, cwd: params.cwd, error }),
      ),
    );

  return {
    start: ({ cwd }) => {
      const sessionId = randomUUID();
      return track({
        cwd,
        sessionId,
        sessionArgs: ["--session-id", sessionId],
      });
    },
    resume: ({ cwd, sessionId }) => {
      const running = sessions.live(sessionId);
      if (running) return running;
      // The id becomes a command-line argument, so it must not read as a flag.
      if (!z.uuid().safeParse(sessionId).success)
        return Promise.resolve(
          R.failure(new Error(`${sessionId} is not a Claude Code session id`)),
        );
      return track({ cwd, sessionId, sessionArgs: ["--resume", sessionId] });
    },
  };
}
