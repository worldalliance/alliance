import { useEffect, useRef, useState } from "react";
import type { IpcResult } from "../../shared/ipc";
import { agent } from "./agent";
import {
  ClaudeAccess,
  type ClaudeState,
  signInHeading,
  SignInPanel,
} from "./components/SignInPanel";

const claudeState = (
  signedIn: IpcResult<boolean>,
): Extract<
  ClaudeState,
  {
    access:
      | ClaudeAccess.SignedIn
      | ClaudeAccess.SignedOut
      | ClaudeAccess.Unavailable;
  }
> =>
  signedIn.ok
    ? {
        access: signedIn.value ? ClaudeAccess.SignedIn : ClaudeAccess.SignedOut,
      }
    : { access: ClaudeAccess.Unavailable, problem: signedIn.error };

export function App() {
  const [claude, setClaude] = useState<ClaudeState>({
    access: ClaudeAccess.Checking,
  });
  const signInCancelled = useRef(false);
  const signingIn = useRef(false);

  useEffect(() => {
    let current = true;
    void agent.claudeSignedIn().then((signedIn) => {
      if (current) setClaude(claudeState(signedIn));
    });
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    document.title =
      claude.access === ClaudeAccess.SignedIn
        ? "Alliance agent"
        : `${signInHeading[claude.access]} – Alliance agent`;
  }, [claude.access]);

  const checkClaude = async () => {
    setClaude({ access: ClaudeAccess.Checking });
    setClaude(claudeState(await agent.claudeSignedIn()));
  };

  const signIn = async () => {
    signInCancelled.current = false;
    setClaude({ access: ClaudeAccess.SigningIn, cancelling: false });
    signingIn.current = true;
    const signedIn = await agent.signIn();
    signingIn.current = false;
    if (!signInCancelled.current) setClaude({ access: ClaudeAccess.Checking });
    const checked = claudeState(await agent.claudeSignedIn());
    if (signInCancelled.current) return setClaude(checked);
    switch (checked.access) {
      case ClaudeAccess.SignedIn:
        return setClaude(checked);
      case ClaudeAccess.Unavailable:
        return setClaude(
          signedIn.ok || signedIn.error === checked.problem
            ? checked
            : { ...checked, problem: `${signedIn.error}\n${checked.problem}` },
        );
      case ClaudeAccess.SignedOut:
        return setClaude({
          access: ClaudeAccess.SignedOut,
          problem: signedIn.ok
            ? "Claude Code still reports you're signed out."
            : signedIn.error,
        });
      default:
        throw new Error(`unknown access: ${checked satisfies never}`);
    }
  };

  return (
    <main>
      {claude.access !== ClaudeAccess.SignedIn && (
        <SignInPanel
          state={claude}
          onSignIn={() => void signIn()}
          onCancel={() => {
            // Once the sign-in's reply arrives, a Cancel has nothing to stop and would hide why it failed.
            if (!signingIn.current) return;
            signInCancelled.current = true;
            setClaude({ access: ClaudeAccess.SigningIn, cancelling: true });
            agent.cancelSignIn();
          }}
          onCheckAgain={() => void checkClaude()}
        />
      )}
    </main>
  );
}
