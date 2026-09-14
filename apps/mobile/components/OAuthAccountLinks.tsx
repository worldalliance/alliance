import { errorMessage } from "@alliance/common/errorMessage";
import {
  OAUTH_PROVIDER_LABEL,
  OAuthError,
  OAuthIntent,
  OAuthProvider,
  oauthErrorMessage,
} from "@alliance/common/oauth";
import {
  oAuthCompleteLink,
  oAuthNativeLink,
  oAuthUnlink,
} from "@alliance/shared/client";
import { isLastWayIn, lastWayInNotice } from "@alliance/shared/lib/oauth";
import { useState } from "react";
import { View } from "react-native";
import { useAuth } from "../lib/AuthContext";
import { signInWith } from "../lib/oauth";
import AppleIcon from "./system/AppleIcon";
import Button, { ButtonColor } from "./system/Button";
import GoogleIcon from "./system/GoogleIcon";
import Text from "./system/Text";

const ICON: Record<OAuthProvider, () => React.JSX.Element> = {
  [OAuthProvider.Google]: () => <GoogleIcon />,
  [OAuthProvider.Apple]: () => <AppleIcon />,
};

const OAuthAccountLink = ({
  provider,
  unlinking,
  setUnlinking,
}: {
  provider: OAuthProvider;
  unlinking: OAuthProvider | null;
  setUnlinking: (provider: OAuthProvider | null) => void;
}) => {
  const { user, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = OAUTH_PROVIDER_LABEL[provider];
  const Icon = ICON[provider];
  const account = user?.oauthAccounts?.find((a) => a.provider === provider);

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await signInWith({ provider, intent: OAuthIntent.Link });
      if (!result.ok) {
        if (result.error !== OAuthError.Cancelled) {
          setError(oauthErrorMessage(provider, result.error));
        }
        return;
      }

      const signIn = result.value;
      // A browser flow's callback wrote nothing. Presenting the secret from
      // the start call is what tells the server this app is the one that asked.
      const linked =
        signIn.kind === "native"
          ? await oAuthNativeLink({
              path: { provider },
              body: { identityToken: signIn.identityToken },
            })
          : await oAuthCompleteLink({
              path: { provider },
              body: { handoff: signIn.handoff, proof: signIn.proof },
            });
      if (linked.error) {
        setError(
          errorMessage({ error: linked.error, fallback: "Could not connect" }),
        );
        return;
      }
      await refreshUser();
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setUnlinking(provider);
    setError(null);
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
      setUnlinking(null);
    }
  };

  if (!user) {
    return null;
  }

  const lastWayIn = isLastWayIn(user, provider);

  return (
    <View>
      <View className="flex-row items-center gap-x-3 mb-2">
        <Icon />
        <Text className="flex-1 text-sm text-zinc-600">
          {account
            ? `Signing in with ${label} as ${account.email}`
            : `Connect ${label} to sign in with one tap.`}
        </Text>
      </View>
      <Button
        color={ButtonColor.White}
        onPress={account ? handleDisconnect : handleConnect}
        loading={busy || unlinking === provider}
        disabled={busy || unlinking !== null || lastWayIn}
        title={account ? `Disconnect ${label}` : `Connect ${label}`}
      />
      {lastWayIn && (
        <Text className="text-sm text-zinc-500 mt-2">
          {lastWayInNotice(provider)}
        </Text>
      )}
      {error && <Text className="text-sm text-red-700 mt-2">{error}</Text>}
    </View>
  );
};

const OAuthAccountLinks = () => {
  const { user } = useAuth();
  // Without a password, a disconnect sent while another is in flight is the
  // one the server refuses as the last way in.
  const [unlinking, setUnlinking] = useState<OAuthProvider | null>(null);

  if (!user) {
    return null;
  }

  return (
    <View className="mt-6 border-t border-zinc-200 pt-6 gap-y-6">
      {Object.values(OAuthProvider).map((provider) => (
        <OAuthAccountLink
          key={provider}
          provider={provider}
          unlinking={unlinking}
          setUnlinking={setUnlinking}
        />
      ))}
    </View>
  );
};

export default OAuthAccountLinks;
