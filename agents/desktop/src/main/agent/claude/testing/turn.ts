import { R } from "../../../../../../../common/src/result";
import {
  type AgentEvent,
  AgentEventKind,
} from "../../../../shared/agent-event";
import { type AgentMessage, type AgentSession } from "../../session";

export type TurnObserver = (event: AgentEvent, events: AgentEvent[]) => void;

export const text = (value: string): AgentMessage => ({
  text: value,
  images: [],
});

export function turn({
  session,
  message,
  onEvent = () => undefined,
}: {
  session: AgentSession;
  message: AgentMessage;
  onEvent?: TurnObserver;
}): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  return new Promise((resolve) => {
    const unsubscribe = session.subscribe((event) => {
      events.push(event);
      onEvent(event, events);
      if (event.kind !== AgentEventKind.TurnEnded) return;
      unsubscribe();
      resolve(events);
    });
    R.unwrap(session.send(message));
  });
}

/** The captured interrupt comes on the fifth delta, so a replay acts there too. */
export const onFifthDelta =
  (act: () => void): TurnObserver =>
  (event, events) => {
    if (
      event.kind === AgentEventKind.AssistantTextDelta &&
      events.filter((e) => e.kind === AgentEventKind.AssistantTextDelta)
        .length === 5
    )
      act();
  };
