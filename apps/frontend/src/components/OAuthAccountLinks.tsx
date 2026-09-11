import { errorMessage } from "@alliance/common/errorMessage";
import {
  OAUTH_PROVIDER_LABEL,
  OAuthIntent,
  OAuthProvider,
} from "@alliance/common/oauth";
import { oAuthUnlink } from "@alliance/shared/client";
import { isLastWayIn } from "@alliance/shared/lib/oauth";
import { getBaseUrl } from "@alliance/sharedweb/lib/config";
import {
  oauthNoticeMessage,
  oauthStartUrl,
  useAppOrigin,
  useOAuthNotice,
} from "@alliance/sharedweb/lib/oauth";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import OAuthProviderIcon from "@alliance/sharedweb/ui/icons/OAuthProviderIcon";
import React, { useState } from "react";
import { href } from "react-router";
import { useAuth } from "../lib/AuthContext";
import { getApiUrl } from "../lib/config";

const OAuthAccountLink: React.FC<{ provider: OAuthProvider }> = ({
  provider,
}) => {
  const { user, refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [unlinking, setUnlinking] = useState(false);
  const label = OAUTH_PROVIDER_LABEL[provider];
  const account = user?.oauthAccounts?.find((a) => a.provider === provider);
  const origin = useAppOrigin(getBaseUrl());

  const handleUnlink = async () => {
    setError(null);
    setUnlinking(true);
    try {
      const resp = await oAuthUnlink({ path: { provider } });
      if (resp.error) {
        setError(
          errorMessage({ error: resp.error, fallback: "Could not disconnect" }),
        );
        return;
      }
      await refreshUser();
    } finally {
      setUnlinking(false);
    }
  };

  if (!user) {
    return null;
  }

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
              disabled={unlinking || isLastWayIn(user)}
            >
              {unlinking ? "Disconnecting..." : `Disconnect ${label}`}
            </Button>
          </>
        ) : (
          <>
            <p className="flex-1 text-sm text-zinc-600">
              Connect {label} to sign in with one tap.
            </p>
            <a
              href={oauthStartUrl({
                apiUrl: getApiUrl(),
                provider,
                intent: OAuthIntent.Link,
                returnTo: `${origin}${href("/settings")}`,
              })}
              className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Connect {label}
            </a>
          </>
        )}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
};

const OAuthAccountLinks: React.FC = () => {
  const { user } = useAuth();
  const notice = useOAuthNotice();
  const message = notice && oauthNoticeMessage(notice);

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 border-t border-zinc-200 pt-4">
      {Object.values(OAuthProvider).map((provider) => (
        <OAuthAccountLink key={provider} provider={provider} />
      ))}
      {isLastWayIn(user) && (
        <p className="text-sm text-zinc-500">
          That is the only way into your account right now. Send yourself a
          reset link above to set a password first.
        </p>
      )}
      {message && (
        <p
          className={`text-sm ${notice.kind === "error" ? "text-red-700" : "text-green"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
};

export default OAuthAccountLinks;
