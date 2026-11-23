import { focusIfLost } from "./focus";

export enum Opened {
  Opening = "opening",
  Open = "open",
}

export type OpenState = Opened | { problem: string };

export function notOpenPanel(params: {
  state: OpenState;
  onRetry: () => void;
}) {
  const { state } = params;
  if (typeof state === "object")
    return (
      <div className="panel">
        <p className="error" role="alert">
          Alliance agent couldn't open this conversation: {state.problem}
        </p>
        <button type="button" ref={focusIfLost} onClick={params.onRetry}>
          Try again
        </button>
      </div>
    );
  switch (state) {
    case Opened.Opening:
      return (
        <p className="panel" role="status" tabIndex={-1} ref={focusIfLost}>
          Opening the conversation…
        </p>
      );
    case Opened.Open:
      return undefined;
    default:
      throw new Error(`unknown open state: ${state satisfies never}`);
  }
}
