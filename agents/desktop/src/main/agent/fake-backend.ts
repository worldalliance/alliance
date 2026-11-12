import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { R, type Result } from "../../../../../common/src/result";
import { type AgentEvent, AgentEventKind } from "../../shared/agent-event";
import { SessionListeners } from "./listeners";
import {
  type AgentBackend,
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
  readonly id: string;
  private nextTurn: number;
  private turn: AbortController | undefined;
  private playing: Promise<void> = Promise.resolve();
  private closing: Promise<void> | undefined;
  private readonly params: FakeBackendParams;
  private readonly onClosing: (session: FakeSession) => void;
  private readonly listeners: SessionListeners;

  constructor(init: {
    params: FakeBackendParams;
    onClosing: (session: FakeSession) => void;
    resumes?: FakeSession;
  }) {
    this.params = init.params;
    this.onClosing = init.onClosing;
    this.id = init.resumes?.id ?? randomUUID();
    this.nextTurn = init.resumes?.nextTurn ?? 0;
    this.listeners = new SessionListeners(this.id);
  }

  get turnRunning(): boolean {
    return this.turn !== undefined;
  }

  send(message: AgentMessage): Result<void, Error> {
    if (this.turn)
      return R.failure(new Error(`session ${this.id} is mid-turn`));
    this.turn = new AbortController();
    this.playing = this.play(this.eventsFor(message), this.turn.signal);
    return R.success(undefined);
  }

  interrupt(): void {
    this.turn?.abort();
  }

  subscribe(listener: AgentEventListener): () => void {
    return this.listeners.subscribe(listener);
  }

  close(): Promise<void> {
    if (!this.closing) {
      this.closing = this.shutDown();
      this.onClosing(this);
    }
    return this.closing;
  }

  private async shutDown(): Promise<void> {
    this.turn?.abort();
    await this.playing;
  }

  private eventsFor(message: AgentMessage): readonly AgentEvent[] {
    const error = (text: string): AgentEvent[] => [
      { kind: AgentEventKind.Error, message: text },
    ];
    if (this.closing) return error(`The fake session ${this.id} is closed.`);
    const turn = this.params.script[this.nextTurn++];
    return turn
      ? turn(message)
      : error("The fake session's script has no more turns.");
  }

  private async play(
    events: readonly AgentEvent[],
    signal: AbortSignal,
  ): Promise<void> {
    for (const event of events) {
      await setTimeout(this.params.stepDelayMs);
      if (signal.aborted) break;
      this.listeners.emit(event);
    }
    if (!signal.aborted) await setTimeout(this.params.stepDelayMs);
    this.turn = undefined;
    this.listeners.emit({
      kind: AgentEventKind.TurnEnded,
      interrupted: signal.aborted,
    });
  }
}

export function createFakeBackend(params: FakeBackendParams): AgentBackend {
  const live = new Map<string, FakeSession>();
  const closed = new Map<string, FakeSession>();
  const onClosing = (session: FakeSession) => {
    live.delete(session.id);
    closed.set(session.id, session);
  };
  const open = (resumes?: FakeSession): Result<AgentSession, Error> => {
    const session = new FakeSession({ params, onClosing, resumes });
    live.set(session.id, session);
    return R.success(session);
  };
  return {
    start: () => Promise.resolve(open()),
    resume: async ({ sessionId }) => {
      const session = live.get(sessionId);
      if (session) return R.success(session);
      const ended = closed.get(sessionId);
      if (!ended) return R.failure(new Error(`no fake session ${sessionId}`));
      await ended.close();
      const resumed = live.get(sessionId);
      return resumed ? R.success(resumed) : open(ended);
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
    { kind: AgentEventKind.AssistantTextDelta, text: "Let me check " },
    { kind: AgentEventKind.AssistantTextDelta, text: "the tests." },
    { kind: AgentEventKind.AssistantText, text: "Let me check the tests." },
    {
      kind: AgentEventKind.Error,
      message: "API Error: 529 Overloaded. Try again in a moment.",
    },
  ],
];
