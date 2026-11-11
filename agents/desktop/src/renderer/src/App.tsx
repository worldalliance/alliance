import { useEffect, useRef, useState } from "react";
import type { IpcResult } from "../../shared/ipc";
import { agent } from "./agent";
import {
  ClaudeAccess,
  type ClaudeState,
  SignInPanel,
} from "./components/SignInPanel";

const claudeState = (signedIn: IpcResult<boolean>): ClaudeState =>
  signedIn.ok
    ? {
        access: signedIn.value ? ClaudeAccess.SignedIn : ClaudeAccess.SignedOut,
      }
    : { access: ClaudeAccess.Unavailable, problem: signedIn.error };

const signInTitle: Record<ClaudeAccess, string | undefined> = {
  [ClaudeAccess.Checking]: "Checking your Claude sign-in",
  [ClaudeAccess.SignedIn]: undefined,
  [ClaudeAccess.SignedOut]: "Sign in to Claude",
  [ClaudeAccess.SigningIn]: "Sign in to Claude",
  [ClaudeAccess.Unavailable]: "Claude isn't available",
};

export function App() {
  const [claude, setClaude] = useState<ClaudeState>({
    access: ClaudeAccess.Checking,
  });
  const signInCancelled = useRef(false);

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
    const view = signInTitle[claude.access];
    document.title = view ? `${view} – Alliance agent` : "Alliance agent";
  }, [claude.access]);

  const checkClaude = async () => {
    setClaude({ access: ClaudeAccess.Checking });
    setClaude(claudeState(await agent.claudeSignedIn()));
  };

  const signIn = async () => {
    signInCancelled.current = false;
    setClaude({ access: ClaudeAccess.SigningIn, cancelling: false });
    const signedIn = await agent.signIn();
    if (signedIn.ok) {
      setClaude({ access: ClaudeAccess.Checking });
      const checked = claudeState(await agent.claudeSignedIn());
      return setClaude(
        checked.access === ClaudeAccess.SignedOut
          ? {
              ...checked,
              problem: "Claude Code still reports you're signed out.",
            }
          : checked,
      );
    }
    if (!signInCancelled.current) setClaude({ access: ClaudeAccess.Checking });
    const checked = claudeState(await agent.claudeSignedIn());
    if (signInCancelled.current || checked.access !== ClaudeAccess.SignedOut)
      return setClaude(checked);
    setClaude({ ...checked, problem: signedIn.error });
  };

  return (
    <main>
      {claude.access !== ClaudeAccess.SignedIn && (
        <SignInPanel
          state={claude}
          onSignIn={() => void signIn()}
          onCancel={() => {
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
