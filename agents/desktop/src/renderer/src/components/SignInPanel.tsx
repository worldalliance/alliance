import { type AgentKind, agentWords } from "../../../shared/agent-kind";
import { focusIfLost } from "../focus";
import { pressOnce } from "../press-once";

export enum Access {
  Checking = "checking",
  SignedIn = "signed_in",
  SignedOut = "signed_out",
  SigningIn = "signing_in",
  Unavailable = "unavailable",
}

export type AccessState = { access: Access.SignedIn } | SignInState;

type SignInState =
  | { access: Access.Checking }
  | { access: Access.SigningIn; cancelling: boolean }
  | { access: Access.SignedOut; problem?: string }
  | { access: Access.Unavailable; problem: string };

const heading = (agent: AgentKind): Record<SignInState["access"], string> => {
  const { name } = agentWords[agent];
  return {
    [Access.Checking]: `Checking your ${name} sign-in`,
    [Access.SignedOut]: `Sign in to ${name}`,
    [Access.SigningIn]: `Sign in to ${name}`,
    [Access.Unavailable]: `${name} isn't available`,
  };
};

// The failure's own text, CLI output and exit codes included, stays behind Details so the alert reads as plain words.
function Problem({ summary, detail }: { summary: string; detail: string }) {
  return (
    <div role="alert">
      <p className="error">{summary}</p>
      <details>
        <summary>Details</summary>
        <pre className="output">{detail}</pre>
      </details>
    </div>
  );
}

/** Shown in place of the message box while the agent isn't signed in. It takes focus only from the page body, so selecting a conversation keeps focus on the sidebar. */
export function SignInPanel({
  agent,
  state,
  onSignIn,
  onCancel,
  onCheckAgain,
}: {
  agent: AgentKind;
  state: SignInState;
  onSignIn: () => void;
  onCancel: () => void;
  onCheckAgain: () => void;
}) {
  const { name, subscription } = agentWords[agent];
  const headings = heading(agent);
  switch (state.access) {
    case Access.Checking:
      return (
        <p className="panel" role="status" tabIndex={-1} ref={focusIfLost}>
          {headings[Access.Checking]}…
        </p>
      );
    case Access.Unavailable:
      return (
        <div className="panel">
          <h2>{headings[state.access]}</h2>
          <Problem
            summary={`Alliance agent couldn't check whether you're signed in to ${name}.`}
            detail={state.problem}
          />
          <button type="button" ref={focusIfLost} {...pressOnce(onCheckAgain)}>
            Check again
          </button>
        </div>
      );
    case Access.SignedOut:
      return (
        <div className="panel">
          <h2>{headings[state.access]}</h2>
          <p>
            Alliance agent uses your own {subscription} subscription. Signing in
            opens your browser.
          </p>
          {state.problem && (
            <Problem
              summary="Sign-in didn't finish. Try signing in again."
              detail={state.problem}
            />
          )}
          <button
            type="button"
            className="primary"
            ref={focusIfLost}
            {...pressOnce(onSignIn)}
          >
            {headings[Access.SignedOut]}
          </button>
        </div>
      );
    case Access.SigningIn:
      return (
        <div className="panel">
          <h2>{headings[state.access]}</h2>
          <p id="sign-in-instruction" role="status">
            {state.cancelling
              ? "Cancelling sign-in…"
              : "Continue in your browser to finish signing in."}
          </p>
          {/* aria-disabled rather than disabled keeps focus here until the CLI exits and Sign in takes it. */}
          <button
            type="button"
            ref={focusIfLost}
            aria-describedby="sign-in-instruction"
            aria-disabled={state.cancelling || undefined}
            {...pressOnce(() => {
              if (!state.cancelling) onCancel();
            })}
          >
            Cancel sign-in
          </button>
        </div>
      );
    default:
      throw new Error(`unknown access: ${state satisfies never}`);
  }
}
