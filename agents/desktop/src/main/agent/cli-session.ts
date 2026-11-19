import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { R, type Result } from "../../../../../common/src/result";
import { AgentEventKind } from "../../shared/agent-event";
import { SessionListeners } from "./listeners";
import type { AgentEventListener, AgentMessage, AgentSession } from "./session";
import type { SessionHooks } from "./session-registry";

const stderrTailLength = 4000;

export abstract class CliSession<
  Turn extends { interrupted: boolean },
> implements AgentSession {
  abstract readonly id: string;
  readonly firstMessageRead: Promise<boolean>;
  protected readonly settleFirstMessageRead: (read: boolean) => void;
  protected turn: Turn | undefined;
  protected exited = false;
  protected readonly listeners = new SessionListeners(() => this.id);
  protected readonly closed: Promise<void>;
  private exitMessage = "";
  private closing: Promise<void> | undefined;
  private stderrTail = "";

  constructor(
    protected readonly init: SessionHooks & {
      child: ChildProcessWithoutNullStreams;
      product: string;
    },
  ) {
    const { child } = init;
    const firstMessageRead = Promise.withResolvers<boolean>();
    this.firstMessageRead = firstMessageRead.promise;
    this.settleFirstMessageRead = firstMessageRead.resolve;
    // Writes to a CLI that has just exited fail with EPIPE; its exit is reported instead.
    child.stdin.on("error", () => undefined);
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => {
      this.stderrTail = (this.stderrTail + chunk).slice(-stderrTailLength);
    });
    this.closed = new Promise((resolve) =>
      child.once("close", (code, signal) => {
        this.exited = true;
        this.settleFirstMessageRead(false);
        const stderr = this.stderrTail.trim();
        this.exitMessage = `${init.product} exited (${signal ?? `code ${code}`}).${stderr ? `\n${stderr}` : ""}`;
        this.onExited(this.exitMessage);
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

  protected abstract newTurn(): Turn;
  /** Emits no event before returning. */
  protected abstract startTurn(turn: Turn, message: AgentMessage): void;
  /** Emits no event before returning. */
  protected abstract sendInterrupt(turn: Turn): void;
  /** Resolves once the CLI has exited. */
  protected abstract shutDown(): Promise<void>;
  protected onExited(_message: string): void {}

  get turnRunning(): boolean {
    return this.turn !== undefined;
  }

  send(message: AgentMessage): Result<void, Error> {
    if (this.turn)
      return R.failure(new Error(`session ${this.id} is mid-turn`));
    const turn = this.newTurn();
    this.turn = turn;
    if (this.exited || this.closing) {
      const message = this.closing
        ? "This session was closed. Resume it to continue."
        : `${this.exitMessage}\nResume the session to continue.`;
      queueMicrotask(() => {
        this.emitError({ message, needsResume: true });
        this.endTurn({ interrupted: false });
      });
    } else {
      this.startTurn(turn, message);
    }
    return R.success(undefined);
  }

  interrupt(): void {
    if (!this.turn || this.turn.interrupted || this.exited) return;
    this.turn.interrupted = true;
    this.sendInterrupt(this.turn);
  }

  subscribe(listener: AgentEventListener): () => void {
    return this.listeners.subscribe(listener);
  }

  close(): Promise<void> {
    if (!this.closing) {
      this.closing = this.shutDown();
      this.init.onClosing(this.closing);
    }
    return this.closing;
  }

  protected emitError(error: { message: string; needsResume: boolean }): void {
    this.listeners.emit({ kind: AgentEventKind.Error, ...error });
  }

  protected endTurn({ interrupted }: { interrupted: boolean }): void {
    this.turn = undefined;
    this.listeners.emit({ kind: AgentEventKind.TurnEnded, interrupted });
  }
}
