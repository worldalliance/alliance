import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { R } from "../result";
import {
  type AgentBackend,
  type AgentEvent,
  AgentEventKind,
  type AgentEventListener,
  type AgentMessage,
  type AgentSession,
} from "./session";

export type FakeTurn = (
  message: AgentMessage,
) => readonly Exclude<AgentEvent, { kind: AgentEventKind.TurnEnded }>[];

export type FakeBackendParams = {
  script: readonly FakeTurn[];
  stepDelayMs: number;
};

class FakeSession implements AgentSession {
  readonly id = randomUUID();
  private nextTurn = 0;
  private turn: AbortController | undefined;
  private readonly listeners = new Set<AgentEventListener>();

  constructor(private readonly params: FakeBackendParams) {}

  send(message: AgentMessage): void {
    if (this.turn) throw new Error(`session ${this.id} is mid-turn`);
    const turn = this.params.script[this.nextTurn++];
    const events: readonly AgentEvent[] = turn
      ? turn(message)
      : [
          {
            kind: AgentEventKind.Error,
            message: "The fake session's script has no more turns.",
          },
        ];
    this.turn = new AbortController();
    void this.play(events, this.turn.signal);
  }

  interrupt(): void {
    this.turn?.abort();
  }

  subscribe(listener: AgentEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private async play(
    events: readonly AgentEvent[],
    signal: AbortSignal,
  ): Promise<void> {
    for (const event of events) {
      await setTimeout(this.params.stepDelayMs);
      if (signal.aborted) break;
      this.emit(event);
    }
    await setTimeout(this.params.stepDelayMs);
    this.endTurn();
  }

  private endTurn(): void {
    this.turn = undefined;
    this.emit({ kind: AgentEventKind.TurnEnded });
  }

  private emit(event: AgentEvent): void {
    for (const listener of [...this.listeners]) {
      if (!this.listeners.has(listener)) continue;
      try {
        listener(event);
      } catch (error) {
        console.error(
          `session ${this.id} listener threw on ${event.kind}`,
          error,
        );
      }
    }
  }
}

export function createFakeBackend(params: FakeBackendParams): AgentBackend {
  const sessions = new Map<string, FakeSession>();
  return {
    start: () => {
      const session = new FakeSession(params);
      sessions.set(session.id, session);
      return Promise.resolve(R.success(session));
    },
    resume: ({ sessionId }) => {
      const session = sessions.get(sessionId);
      return Promise.resolve(
        session
          ? R.success(session)
          : R.failure(new Error(`no fake session ${sessionId}`)),
      );
    },
  };
}

export const demoScript: readonly FakeTurn[] = [
  () => [
    { kind: AgentEventKind.AssistantText, text: "I'll read the README first." },
    {
      kind: AgentEventKind.ToolStarted,
      toolCallId: "read-1",
      name: "Read",
      input: { file_path: "README.md" },
    },
    {
      kind: AgentEventKind.ToolFinished,
      toolCallId: "read-1",
      output: "# The Alliance\n\nA platform for collective action.",
      isError: false,
    },
    {
      kind: AgentEventKind.ToolStarted,
      toolCallId: "bash-1",
      name: "Bash",
      input: { command: "bun run typecheck" },
    },
    {
      kind: AgentEventKind.ToolFinished,
      toolCallId: "bash-1",
      output: 'error: Script not found "typecheck"',
      isError: true,
    },
    {
      kind: AgentEventKind.AssistantText,
      text: "The README describes the Alliance. The repo root has no typecheck script; each package has its own.",
    },
  ],
  (message) => [
    {
      kind: AgentEventKind.AssistantText,
      text:
        message.images.length === 0
          ? "I don't see an image. Paste or drop a screenshot and send it again."
          : `I can see ${message.images.length === 1 ? "your image" : `your ${message.images.length} images`} (${message.images.map((image) => image.mediaType).join(", ")}).`,
    },
  ],
  () => [
    { kind: AgentEventKind.AssistantText, text: "Let me check the tests." },
    {
      kind: AgentEventKind.Error,
      message: "API Error: 529 Overloaded. Try again in a moment.",
    },
  ],
];
