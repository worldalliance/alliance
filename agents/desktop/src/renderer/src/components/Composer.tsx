import {
  type KeyboardEvent,
  type RefObject,
  useCallback,
  useId,
  useState,
} from "react";
import { TurnState } from "../chat-state";
import { focusIfLost } from "../focus";
import { pressOnce } from "../press-once";

const idleHint = "Press Enter to send, Shift+Enter for a new line.";
const replying = Symbol("replying");

const stopButton: Record<
  TurnState,
  { label: string; stopping: boolean; busy: string } | undefined
> = {
  [TurnState.Idle]: undefined,
  [TurnState.Running]: {
    label: "Stop",
    stopping: false,
    busy: "Claude is still replying. Wait for it to finish, or stop it.",
  },
  [TurnState.Stopping]: {
    label: "Stopping…",
    stopping: true,
    busy: "Claude is stopping. Send your message once it has stopped.",
  },
};

/** The box's text, kept by the caller so it outlives the box. */
export type Draft = {
  text: string;
  onChange: (update: string | ((text: string) => string)) => void;
};

/** onSend returns whether the message went, so a refused one returns to the box. */
export function Composer({
  draft,
  turn,
  onSend,
  onStop,
  pendingLabel,
  boxRef,
}: {
  draft: Draft;
  turn: TurnState;
  /** Replaces Send while the previous send is still being accepted, such as "Starting…". */
  pendingLabel?: string;
  onSend: (text: string) => Promise<boolean>;
  onStop?: () => void;
  boxRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const { text } = draft;
  const [problem, setProblem] = useState<string | typeof replying>();
  const stop = stopButton[turn];
  if (!stop && problem === replying) setProblem(undefined);
  const shownProblem = problem === replying ? stop?.busy : problem;
  const inputId = useId();
  const hintId = useId();
  const box = useCallback(
    (element: HTMLTextAreaElement | null) => {
      focusIfLost(element);
      if (boxRef) boxRef.current = element;
    },
    [boxRef],
  );

  const submit = async () => {
    if (pendingLabel) return;
    if (stop) return setProblem(replying);
    if (!text.trim()) return setProblem("Type a message first.");
    setProblem(undefined);
    // The box clears before the send resolves, so text typed meanwhile isn't cleared with it.
    draft.onChange("");
    if (!(await onSend(text)))
      draft.onChange((typed) => (typed ? `${text}\n${typed}` : text));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    )
      return;
    event.preventDefault();
    if (!event.repeat) void submit();
  };

  return (
    <form className="composer">
      <label htmlFor={inputId}>Message Claude</label>
      <textarea
        id={inputId}
        rows={3}
        value={text}
        ref={box}
        readOnly={pendingLabel !== undefined}
        aria-describedby={hintId}
        aria-invalid={shownProblem ? true : undefined}
        onChange={(event) => {
          draft.onChange(event.target.value);
          setProblem(undefined);
        }}
        onKeyDown={onKeyDown}
      />
      <div className="composer-actions">
        {shownProblem ? (
          <p key="problem" id={hintId} className="hint problem" role="alert">
            {shownProblem}
          </p>
        ) : (
          <p key="hint" id={hintId} className="hint">
            {idleHint}
          </p>
        )}
        {/* React reuses one button for Send and Stop, so both take pressOnce, and aria-disabled rather than disabled keeps focus on it as it changes. */}
        {!stop || !onStop ? (
          <button
            type="button"
            className="primary"
            {...pressOnce(() => void submit())}
            aria-disabled={pendingLabel !== undefined || undefined}
          >
            {pendingLabel ?? "Send"}
          </button>
        ) : (
          <button
            type="button"
            {...pressOnce(() => {
              if (!stop.stopping) onStop();
            })}
            aria-disabled={stop.stopping || undefined}
          >
            {stop.label}
          </button>
        )}
      </div>
    </form>
  );
}
