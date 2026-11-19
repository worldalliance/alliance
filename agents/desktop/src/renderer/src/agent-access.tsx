import { type ReactNode, useEffect, useRef, useState } from "react";
import { type AgentKind, agentWords } from "../../shared/agent-kind";
import type { IpcResult } from "../../shared/ipc";
import { agent as api } from "./agent";
import {
  Access,
  type AccessState,
  SignInPanel,
} from "./components/SignInPanel";

const accessState = (
  signedIn: IpcResult<boolean>,
): Extract<
  AccessState,
  { access: Access.SignedIn | Access.SignedOut | Access.Unavailable }
> =>
  signedIn.ok
    ? { access: signedIn.value ? Access.SignedIn : Access.SignedOut }
    : { access: Access.Unavailable, problem: signedIn.error };

/** Each agent's sign-in, checked the first time it is needed, so an agent nobody uses never runs its CLI. signInPanel returns the agent's sign-in panel, or undefined once it is signed in. */
export function useAgentAccess(needed: AgentKind | undefined): {
  signedIn: (agent: AgentKind) => boolean;
  signInPanel: (agent: AgentKind) => ReactNode;
} {
  const [states, setStates] = useState<Partial<Record<AgentKind, AccessState>>>(
    {},
  );
  const checked = useRef(new Set<AgentKind>());
  const cancelled = useRef(new Set<AgentKind>());
  const signingIn = useRef(new Set<AgentKind>());

  const set = (agent: AgentKind, state: AccessState) =>
    setStates((all) => ({ ...all, [agent]: state }));

  const check = async (agent: AgentKind) => {
    set(agent, { access: Access.Checking });
    set(agent, accessState(await api.signedIn(agent)));
  };

  useEffect(() => {
    if (!needed || checked.current.has(needed)) return;
    checked.current.add(needed);
    void check(needed);
  });

  const signIn = async (agent: AgentKind) => {
    cancelled.current.delete(agent);
    set(agent, { access: Access.SigningIn, cancelling: false });
    signingIn.current.add(agent);
    const signedIn = await api.signIn(agent);
    signingIn.current.delete(agent);
    if (!cancelled.current.has(agent)) set(agent, { access: Access.Checking });
    const now = accessState(await api.signedIn(agent));
    if (cancelled.current.has(agent)) return set(agent, now);
    switch (now.access) {
      case Access.SignedIn:
        return set(agent, now);
      case Access.Unavailable:
        return set(
          agent,
          signedIn.ok || signedIn.error === now.problem
            ? now
            : { ...now, problem: `${signedIn.error}\n${now.problem}` },
        );
      case Access.SignedOut:
        return set(agent, {
          access: Access.SignedOut,
          problem: signedIn.ok
            ? `${agentWords[agent].product} still reports you're signed out.`
            : signedIn.error,
        });
      default:
        throw new Error(`unknown access: ${now satisfies never}`);
    }
  };

  return {
    signedIn: (agent) => states[agent]?.access === Access.SignedIn,
    signInPanel: (agent) => {
      const state = states[agent] ?? { access: Access.Checking };
      if (state.access === Access.SignedIn) return undefined;
      return (
        <SignInPanel
          agent={agent}
          state={state}
          onSignIn={() => void signIn(agent)}
          onCancel={() => {
            // Once the sign-in's reply arrives, a Cancel has nothing to stop and would hide why it failed.
            if (!signingIn.current.has(agent)) return;
            cancelled.current.add(agent);
            set(agent, { access: Access.SigningIn, cancelling: true });
            api.cancelSignIn(agent);
          }}
          onCheckAgain={() => void check(agent)}
        />
      );
    },
  };
}
