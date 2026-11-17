import { pressOnce } from "../press-once";

export enum ClaudeAccess {
  Checking = "checking",
  SignedIn = "signed_in",
  SignedOut = "signed_out",
  SigningIn = "signing_in",
  Unavailable = "unavailable",
}

export type ClaudeState = { access: ClaudeAccess.SignedIn } | SignInState;

type SignInState =
  | { access: ClaudeAccess.Checking }
  | { access: ClaudeAccess.SigningIn; cancelling: boolean }
  | { access: ClaudeAccess.SignedOut; problem?: string }
  | { access: ClaudeAccess.Unavailable; problem: string };

/** Each state's window title, and its heading, or status text while checking. */
export const signInHeading: Record<SignInState["access"], string> = {
  [ClaudeAccess.Checking]: "Checking your Claude sign-in",
  [ClaudeAccess.SignedOut]: "Sign in to Claude",
  [ClaudeAccess.SigningIn]: "Sign in to Claude",
  [ClaudeAccess.Unavailable]: "Claude isn't available",
};

// React's autoFocus focuses only form controls.
const focusOnMount = (element: HTMLElement | null) => {
  element?.focus();
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

export function SignInPanel({
  state,
  onSignIn,
  onCancel,
  onCheckAgain,
}: {
  state: SignInState;
  onSignIn: () => void;
  onCancel: () => void;
  onCheckAgain: () => void;
}) {
  switch (state.access) {
    case ClaudeAccess.Checking:
      return (
        <p className="panel" role="status" tabIndex={-1} ref={focusOnMount}>
          {signInHeading[ClaudeAccess.Checking]}…
        </p>
      );
    case ClaudeAccess.Unavailable:
      return (
        <div className="panel">
          <h1>{signInHeading[state.access]}</h1>
          <Problem
            summary="Alliance agent couldn't check your Claude sign-in. Make sure Claude Code is installed and runs, then check again."
            detail={state.problem}
          />
          <button type="button" autoFocus {...pressOnce(onCheckAgain)}>
            Check again
          </button>
        </div>
      );
    case ClaudeAccess.SignedOut:
      return (
        <div className="panel">
          <h1>{signInHeading[state.access]}</h1>
          <p>
            Alliance agent uses your own Claude subscription. Signing in opens
            your browser.
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
            autoFocus
            {...pressOnce(onSignIn)}
          >
            Sign in to Claude
          </button>
        </div>
      );
    case ClaudeAccess.SigningIn:
      return (
        <div className="panel">
          <h1>{signInHeading[state.access]}</h1>
          <p id="sign-in-instruction" role="status">
            {state.cancelling
              ? "Cancelling sign-in…"
              : "Continue in your browser to finish signing in."}
          </p>
          {/* aria-disabled rather than disabled keeps focus here until the CLI exits and Sign in takes it. */}
          <button
            type="button"
            autoFocus
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
