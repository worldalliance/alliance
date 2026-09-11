import { refusalMessage } from "@alliance/common/errorMessage";
import {
  OAUTH_PROVIDER_LABEL,
  OAuthIntent,
  OAuthProvider,
} from "@alliance/common/oauth";
import { R } from "@alliance/common/result";
import { authMe, oAuthUnlink } from "@alliance/shared/client";
import { isLastWayIn, lastWayInNotice } from "@alliance/shared/lib/oauth";
import { cn } from "@alliance/shared/styles/util";
import {
  oauthNoticeMessage,
  oauthStartUrl,
  useOAuthNotice,
  type OAuthNotice,
} from "@alliance/sharedweb/lib/oauth";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import OAuthProviderIcon from "@alliance/sharedweb/ui/icons/OAuthProviderIcon";
import { OAUTH_BUTTON } from "@alliance/sharedweb/ui/OAuthButtons";
import React, { useEffect, useRef, useState } from "react";
import { href } from "react-router";
import { useAuth } from "../lib/AuthContext";
import { getApiUrl } from "../lib/config";

const SESSION_EXPIRED = "Your session has expired. Sign in again first.";

const NOTICE_CLASS: Record<OAuthNotice["kind"], string> = {
  outcome: "text-green",
  error: "text-red-700",
};

const OAuthAccountLink: React.FC<{
  provider: OAuthProvider;
  unlinking: OAuthProvider | null;
  setUnlinking: (provider: OAuthProvider | null) => void;
}> = ({ provider, unlinking, setUnlinking }) => {
  const { user, setUser, refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const label = OAUTH_PROVIDER_LABEL[provider];
  const account = user?.oauthAccounts?.find((a) => a.provider === provider);
  const lastWayIn = !!user && isLastWayIn(user, provider);

  // A refusal describes the member from before the reload it triggers. Once
  // lastWayIn moves, the refusal repeats the notice, or contradicts a
  // disconnect that a new password just freed.
  useEffect(() => setError(null), [lastWayIn]);

  // A navigation skips the client's token refresh, and the link start answers
  // a lapsed access token with a bare 401 page. authMe refreshes it first.
  const handleConnect = async () => {
    setError(null);
    setConnecting(true);
    try {
      const session = await R.fromPromise(authMe());
      if (!session.ok) {
        console.error("Failed to check the session:", session.error);
        setError("Could not connect. Check your connection and try again.");
        return;
      }
      const { error: refused, response } = session.value;
      if (refused) {
        setError(
          refusalMessage({
            status: response.status,
            error: refused,
            fallback: "Could not connect. Please try again.",
            sessionExpired: SESSION_EXPIRED,
          }),
        );
        return;
      }
      window.location.assign(
        oauthStartUrl({
          apiUrl: getApiUrl(),
          provider,
          intent: OAuthIntent.Link,
          returnTo: `${window.location.origin}${href("/settings")}`,
        }),
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleUnlink = async () => {
    setError(null);
    setUnlinking(provider);
    try {
      // The generated client leaves its fetch unguarded, so a request that
      // never reaches the server rejects rather than answering with an error.
      const sent = await R.fromPromise(oAuthUnlink({ path: { provider } }));
      if (!sent.ok) {
        console.error("Failed to disconnect the provider:", sent.error);
        setError("Could not disconnect. Check your connection and try again.");
        return;
      }
      const { data, error: refused, response } = sent.value;
      if (refused) {
        setError(
          refusalMessage({
            status: response.status,
            error: refused,
            fallback: "Could not disconnect. Please try again.",
            sessionExpired: SESSION_EXPIRED,
          }),
        );
        // The rows already hold back a last way in, so a refusal means the
        // member changed since they loaded, for example in another tab.
        if (response.status === 400) {
          await refreshUser();
        }
        return;
      }
      setUser(data.user);
    } finally {
      setUnlinking(null);
    }
  };

  if (!user) {
    return null;
  }

  const lastWayInReason = lastWayInNotice(provider);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <OAuthProviderIcon provider={provider} />
        {account ? (
          <>
            <p className="flex-1 text-sm text-zinc-600">
              Signing in with {label} as{" "}
              <span className="text-zinc-900">{account.email}</span>
            </p>
            <Button
              color={ButtonColor.Light}
              onClick={handleUnlink}
              disabled={unlinking !== null || lastWayIn}
            >
              {unlinking === provider
                ? "Disconnecting..."
                : `Disconnect ${label}`}
            </Button>
          </>
        ) : (
          <>
            <p className="flex-1 text-sm text-zinc-600">
              Connect {label} to sign in with it.
            </p>
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className={cn(
                OAUTH_BUTTON,
                "px-4 py-2 text-sm disabled:opacity-50",
              )}
            >
              {connecting ? "Connecting..." : `Connect ${label}`}
            </button>
          </>
        )}
      </div>
      {lastWayIn && <p className="text-sm text-zinc-500">{lastWayInReason}</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
};

const OAuthAccountLinks: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const notice = useOAuthNotice();
  const message = notice && oauthNoticeMessage(notice);
  const section = useRef<HTMLDivElement>(null);
  // Without a password, a disconnect sent while another is in flight is the
  // one the server refuses as the last way in.
  const [unlinking, setUnlinking] = useState<OAuthProvider | null>(null);
  const awaitingPassword =
    !!user &&
    Object.values(OAuthProvider).some((provider) =>
      isLastWayIn(user, provider),
    );

  // The reset link that sets a password opens from an email, in another tab.
  useEffect(() => {
    if (!awaitingPassword) {
      return;
    }
    const recheck = () => {
      if (document.visibilityState === "visible") {
        refreshUser();
      }
    };
    document.addEventListener("visibilitychange", recheck);
    return () => document.removeEventListener("visibilitychange", recheck);
  }, [awaitingPassword, refreshUser]);

  // The callback lands the member at the top of a long page this sits at the
  // foot of, and useOAuthNotice clears the parameter it read, so a message they
  // scroll past is gone for good.
  useEffect(() => {
    if (message) {
      section.current?.scrollIntoView({ block: "center" });
    }
  }, [message]);

  if (!user) {
    return null;
  }

  return (
    <div
      ref={section}
      className="flex flex-col gap-4 border-t border-zinc-200 pt-4"
    >
      {Object.values(OAuthProvider).map((provider) => (
        <OAuthAccountLink
          key={provider}
          provider={provider}
          unlinking={unlinking}
          setUnlinking={setUnlinking}
        />
      ))}
      {notice && message && (
        <p className={cn("text-sm", NOTICE_CLASS[notice.kind])}>{message}</p>
      )}
    </div>
  );
};

export default OAuthAccountLinks;
