import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { z } from "zod";
import { R, type Result } from "../../../../../../common/src/result";
import { agentEnvironment } from "../agent-environment";
import {
  cancelKillAfterMs,
  couldNotStart,
  spawnSessionCli,
} from "../cli-process";
import { CliSession } from "../cli-session";
import type { AgentBackend, AgentMessage, AgentSession } from "../session";
import { type SessionHooks, sessionRegistry } from "../session-registry";
import { checkClaudeVersion, type ClaudeCli } from "./process";
import {
  ClaudeLineKind,
  claudeSessionArgs,
  interruptLine,
  parseClaudeLine,
  userMessageLine,
} from "./protocol";

class ClaudeSession extends CliSession<{ interrupted: boolean }> {
  readonly id: string;
  private readonly killAfterMs: number;

  constructor(
    init: SessionHooks & {
      id: string;
      child: ChildProcessWithoutNullStreams;
      killAfterMs: number;
    },
  ) {
    super({ ...init, product: "Claude Code" });
    this.id = init.id;
    this.killAfterMs = init.killAfterMs;
    createInterface({ input: init.child.stdout }).on("line", (line) =>
      this.handleLine(line),
    );
  }

  protected newTurn() {
    return { interrupted: false };
  }

  protected startTurn(_turn: unknown, message: AgentMessage): void {
    this.init.child.stdin.write(`${userMessageLine(message)}\n`);
  }

  protected sendInterrupt(): void {
    this.init.child.stdin.write(`${interruptLine(randomUUID())}\n`);
  }

  protected async shutDown(): Promise<void> {
    if (this.exited) return;
    const { child } = this.init;
    child.stdin.end();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const killAfter = (ms: number) =>
      timers.push(setTimeout(() => child.kill("SIGKILL"), ms));
    if (this.turn) {
      // A CLI stopped mid-turn may still send its error result, which a close, like an interrupt, doesn't report.
      this.turn.interrupted = true;
      child.kill("SIGTERM");
      killAfter(this.killAfterMs);
    } else {
      timers.push(
        setTimeout(() => {
          child.kill("SIGTERM");
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
      env: agentEnvironment(cli.folders),
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
    // A Claude Code session is returned as soon as its CLI runs.
    settled: () => Promise.resolve(),
  };
}
