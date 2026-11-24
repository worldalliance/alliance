import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useId,
} from "react";
import {
  type AgentKind,
  agentKinds,
  agentWords,
  defaultAgent,
} from "../../../shared/agent-kind";
import type { IpcResult } from "../../../shared/ipc";
import { TurnState } from "../chat-state";
import { Composer, type Draft } from "./Composer";

/** Kept by the caller, so a start still pending when the user comes back shows as pending. */
export type NewConversation = {
  agent: AgentKind;
  starting: boolean;
  problem?: string;
};

export const newConversation = (): NewConversation => ({
  agent: defaultAgent,
  starting: false,
});

/** The agent choice and first message of a new conversation. */
export function StartView({
  heading,
  hint,
  draft,
  state,
  signInPanel,
  onChange,
  onStart,
}: {
  heading?: ReactNode;
  /** What happens once the message is sent, given the chosen agent's name. */
  hint: (agentName: string) => ReactNode;
  draft: Draft;
  state: NewConversation;
  /** The chosen agent's sign-in, shown in place of the message box until it is signed in. */
  signInPanel: ReactNode;
  onChange: Dispatch<SetStateAction<NewConversation>>;
  /** Fails with the problem in words. */
  onStart: (input: {
    text: string;
    agent: AgentKind;
  }) => Promise<IpcResult<void>>;
}) {
  const { name } = agentWords[state.agent];
  const choiceGroup = useId();

  const start = async (text: string): Promise<boolean> => {
    onChange((all) => ({ ...all, starting: true }));
    const started = await onStart({ text, agent: state.agent });
    onChange((all) => ({
      ...all,
      ...(started.ok && { agent: defaultAgent }),
      starting: false,
      problem: started.ok ? undefined : started.error,
    }));
    return started.ok;
  };

  return (
    <>
      <div className="start">
        {heading}
        <fieldset className="agent-choice">
          <legend>Agent</legend>
          {agentKinds.map((kind) => (
            <label key={kind}>
              <input
                type="radio"
                name={choiceGroup}
                value={kind}
                checked={state.agent === kind}
                aria-disabled={state.starting || undefined}
                onChange={() => {
                  if (!state.starting)
                    onChange((all) => ({
                      ...all,
                      agent: kind,
                      problem: undefined,
                    }));
                }}
              />
              {agentWords[kind].name}
            </label>
          ))}
        </fieldset>
        <p className="hint">{hint(name)}</p>
        {state.problem && (
          <p className="error" role="alert">
            {state.problem}
          </p>
        )}
      </div>
      {signInPanel ? (
        <div className="not-open">{signInPanel}</div>
      ) : (
        <Composer
          agentName={name}
          draft={draft}
          turn={TurnState.Idle}
          pendingLabel={state.starting ? "Starting…" : undefined}
          onSend={start}
        />
      )}
    </>
  );
}
