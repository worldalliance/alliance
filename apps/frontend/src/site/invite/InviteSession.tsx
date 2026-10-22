import { R } from "@alliance/common/result";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { InviteAvailability, useInvite } from "@alliance/shared/lib/useInvite";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { href, useLocation, useNavigate } from "react-router";
import { useAuth } from "../../lib/AuthContext";
import {
  captureInvite,
  loadInviteMemory,
  NO_INVITE,
  saveInviteMemory,
  selectedCode,
  settleInvite,
  type InviteMemory,
} from "./inviteMemory";

const REF_PARAM = "ref";

/** Campaign and action pages read their own `ref`, so only these capture it. */
const CAPTURE_PATHS = new Set([
  href("/"),
  href("/invite"),
  href("/signup"),
  href("/onboarding"),
]);

export enum InviteState {
  /** Restoring, waiting on auth, or checking the selected code. */
  Pending = "pending",
  None = "none",
  Usable = "usable",
  Unavailable = "unavailable",
}

export type InviteSession = {
  state: InviteState;
  /** Set while `state` is Usable. */
  signupHref: string | null;
  forget: () => void;
  /** Drops an unavailable URL code, bringing back the saved invitation it hid. */
  dismiss: () => void;
  /** Forgets the invitation but leaves the URL and lookups alone, for signup to call once it used it. */
  clear: () => void;
  /** The tab may bring the invitation back on reload. */
  forgetFailed: boolean;
};

const STATE_BY_AVAILABILITY: Record<InviteAvailability, InviteState> = {
  [InviteAvailability.Checking]: InviteState.Pending,
  [InviteAvailability.Available]: InviteState.Usable,
  [InviteAvailability.Unknown]: InviteState.Usable,
  [InviteAvailability.Unavailable]: InviteState.Unavailable,
};

const InviteSessionContext = createContext<InviteSession | null>(null);

const inviteSignupHref = (code: string): string =>
  `${href("/signup")}?${REF_PARAM}=${encodeURIComponent(code)}`;

export function InviteSessionProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [memory, setMemory] = useState<InviteMemory>(NO_INVITE);
  const [restored, setRestored] = useState(false);
  const [forgetFailed, setForgetFailed] = useState(false);

  const urlCode = CAPTURE_PATHS.has(location.pathname)
    ? new URLSearchParams(location.search).get(REF_PARAM) || null
    : null;

  useEffect(() => {
    setMemory(loadInviteMemory());
    setRestored(true);
  }, []);

  // A blocked write leaves the code in memory, which still carries it to signup.
  useEffect(() => {
    if (restored) saveInviteMemory(memory);
  }, [memory, restored]);

  useEffect(() => {
    if (!restored || authLoading || isAuthenticated || !urlCode) return;
    setMemory((current) => captureInvite(current, urlCode));
    setForgetFailed(false);
  }, [restored, authLoading, isAuthenticated, urlCode]);

  const code = selectedCode(memory);
  const { availability } = useInvite(isAuthenticated ? null : code);

  useEffect(() => {
    if (code === null) return;
    setMemory((current) => settleInvite(current, { code, availability }));
  }, [code, availability]);

  const replace = useCallback((next: InviteMemory) => {
    setMemory(next);
    const failed = R.isFailure(saveInviteMemory(next));
    // A failed dismiss keeps a code, so only a forget gets the retry notice.
    setForgetFailed(
      failed &&
        selectedCode(next) === null &&
        selectedCode(loadInviteMemory()) !== null,
    );
  }, []);

  const clear = useCallback(() => replace(NO_INVITE), [replace]);

  const drop = useCallback(
    (next: InviteMemory) => {
      replace(next);
      if (code !== null) {
        queryClient.removeQueries({
          queryKey: queryKeys.referrerProfile(code),
        });
        queryClient.removeQueries({ queryKey: queryKeys.onetimeInvite(code) });
      }
      const params = new URLSearchParams(location.search);
      if (CAPTURE_PATHS.has(location.pathname) && params.has(REF_PARAM)) {
        params.delete(REF_PARAM);
        void navigate(
          {
            // The invite page without a code is an error, so its explainer is the homepage.
            pathname:
              location.pathname === href("/invite")
                ? href("/")
                : location.pathname,
            search: params.toString(),
            hash: location.hash,
          },
          { replace: true, preventScrollReset: true },
        );
      }
    },
    [replace, code, queryClient, location, navigate],
  );

  const forget = useCallback(() => drop(NO_INVITE), [drop]);
  const dismiss = useCallback(
    () => drop({ explicit: null, saved: memory.saved }),
    [drop, memory.saved],
  );

  const state = (() => {
    if (!restored || authLoading) return InviteState.Pending;
    if (isAuthenticated) return InviteState.None;
    // Before capture runs, a URL code still hides the saved one.
    if (urlCode !== null && urlCode !== memory.explicit && urlCode !== code) {
      return InviteState.Pending;
    }
    if (code === null) return InviteState.None;
    return STATE_BY_AVAILABILITY[availability];
  })();

  const value = useMemo(
    () => ({
      state,
      signupHref:
        state === InviteState.Usable && code ? inviteSignupHref(code) : null,
      forget,
      dismiss,
      clear,
      forgetFailed,
    }),
    [state, code, forget, dismiss, clear, forgetFailed],
  );

  return (
    <InviteSessionContext.Provider value={value}>
      {children}
    </InviteSessionContext.Provider>
  );
}

export function useInviteSession(): InviteSession {
  const session = useContext(InviteSessionContext);
  if (!session) {
    throw new Error("useInviteSession needs an InviteSessionProvider");
  }
  return session;
}
