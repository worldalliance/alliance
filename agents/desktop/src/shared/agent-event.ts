export enum AgentEventKind {
  AssistantText = "assistant_text",
  AssistantTextDelta = "assistant_text_delta",
  ToolStarted = "tool_started",
  ToolFinished = "tool_finished",
  TurnEnded = "turn_ended",
  Error = "error",
}

/** Every event arrives during a turn, and every turn ends with exactly one TurnEnded, an interrupted or failed one included. TurnEnded closes any tool still open, since a ToolStarted can go without a ToolFinished. A text block arrives as any number of AssistantTextDelta events, each extending it, then one AssistantText holding the whole block, which replaces those deltas; TurnEnded also closes a block left without its AssistantText, as an interrupted turn can do. ToolStarted's name and input differ by CLI, so they are for generic display only. */
export type AgentEvent =
  | { kind: AgentEventKind.AssistantText; text: string }
  | { kind: AgentEventKind.AssistantTextDelta; text: string }
  | {
      kind: AgentEventKind.ToolStarted;
      toolCallId: string;
      name: string;
      input: unknown;
    }
  | {
      kind: AgentEventKind.ToolFinished;
      toolCallId: string;
      output: string;
      isError: boolean;
    }
  | {
      kind: AgentEventKind.TurnEnded;
      /** True when an interrupt or close stopped the turn. */
      interrupted: boolean;
    }
  | {
      kind: AgentEventKind.Error;
      message: string;
      /** True when the session is no longer live, so it takes another message only once resumed. */
      needsResume: boolean;
    };
