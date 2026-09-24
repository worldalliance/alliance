import { OAUTH_PROVIDER_LABEL, OAuthProvider } from "@alliance/common/oauth";
import { R } from "@alliance/common/result";
import { authForgotPassword, type UserDto } from "@alliance/shared/client";
import { disconnectAccount, passwordLink } from "@alliance/shared/lib/copy";
import {
  canDisconnect,
  passwordAction,
  useSignInMethods,
  type SignInMethods,
} from "@alliance/shared/lib/signInMethods";
import { useMutation } from "@tanstack/react-query";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, View } from "react-native";
import { linkProvider } from "../../lib/oauth";
import {
  interruptedLinkFeedback,
  linkFeedback,
  type LinkFeedback,
} from "../../lib/oauthLink";
import { thrownFailure } from "../../lib/oauthResult";
import Button, { ButtonColor, ButtonSize } from "../system/Button";
import Card, { CardStyle } from "../system/Card";
import OAuthProviderIcon from "../system/OAuthProviderIcon";
import Text, { FontWeight } from "../system/Text";

const FeedbackLine = ({ feedback }: { feedback: LinkFeedback | null }) =>
  feedback && (
    <Text
      className={`text-sm mt-2 ${feedback.ok ? "text-green-600" : "text-red-700"}`}
    >
      {feedback.message}
    </Text>
  );

function PasswordAccess({
  email,
  methods,
  loadFailed,
}: {
  email: string;
  methods: SignInMethods | null;
  loadFailed: boolean;
}) {
  const { label, verb } = passwordAction(methods);
  const send = useMutation({
    mutationFn: () => authForgotPassword({ body: { email } }),
  });

  return (
    <View>
      <Button
        color={ButtonColor.Black}
        onPress={() => send.mutate()}
        disabled={(!methods && !loadFailed) || send.isPending}
        title={send.isPending ? "Sending link..." : label}
      />
      <FeedbackLine
        feedback={
          send.isSuccess
            ? {
                ok: true,
                message: passwordLink.sent({ verb, email }),
              }
            : send.isError
              ? {
                  ok: false,
                  message: passwordLink.failed,
                }
              : null
        }
      />
      {send.isIdle && (
        <Text className="text-sm text-zinc-500 mt-2">
          {passwordLink.hint({ verb, email })}
        </Text>
      )}
    </View>
  );
}

export default function AccountSection(props: {
  user: UserDto;
  scrollTo: (y: number) => void;
}) {
  const { user } = props;
  const signIn = useSignInMethods();
  const { reload, settle } = signIn;
  const [connecting, setConnecting] = useState<OAuthProvider | null>(null);
  const [feedback, setFeedback] = useState<LinkFeedback | null>(null);
  const focusedBefore = useRef(false);
  const revealPending = useRef(false);
  const router = useRouter();
  const { oauthInterrupted } = useLocalSearchParams<{
    oauthInterrupted?: string;
  }>();

  useEffect(() => {
    if (!oauthInterrupted) {
      return;
    }
    const interrupted = interruptedLinkFeedback(oauthInterrupted);
    setFeedback(interrupted);
    revealPending.current = interrupted !== null;
    router.setParams({ oauthInterrupted: undefined });
  }, [oauthInterrupted, router]);

  // A password set from the email, or a change on another device, lands here
  // when the member comes back to this screen or to the app. The first focus
  // skips it: the settings form loaded this user just before this mounted.
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) {
        void reload();
      }
      focusedBefore.current = true;
    }, [reload]),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void reload();
      }
    });
    return () => subscription.remove();
  }, [reload]);

  const connect = async (provider: OAuthProvider) => {
    setFeedback(null);
    signIn.resetDisconnect();
    setConnecting(provider);
    const attempt = await R.fromPromiseFn(
      () => linkProvider({ provider, userId: user.id }),
      thrownFailure,
    );
    const result = R.flatMap(attempt, (linked) => linked);
    await settle(result.ok ? result.value : undefined);
    setConnecting(null);
    setFeedback(linkFeedback({ provider, result }));
  };

  const disconnect = (provider: OAuthProvider) => {
    const label = OAUTH_PROVIDER_LABEL[provider];
    Alert.alert(
      disconnectAccount.title(label),
      disconnectAccount.message(label),
      [
        { text: "Cancel", style: "cancel" },
        {
          text: disconnectAccount.confirm(label),
          style: "destructive",
          onPress: () => {
            setFeedback(null);
            signIn.resetDisconnect();
            signIn.disconnect(provider, {
              onSuccess: () =>
                setFeedback({
                  ok: true,
                  message: disconnectAccount.done(label),
                }),
            });
          },
        },
      ],
    );
  };

  const { methods } = signIn;
  const locked = signIn.busy || connecting !== null;

  // The feedback line changes the card's height, so a layout follows the
  // effect that sets revealPending.
  return (
    <Card
      cardStyle={CardStyle.White}
      onLayout={(event) => {
        if (revealPending.current) {
          revealPending.current = false;
          props.scrollTo(event.nativeEvent.layout.y);
        }
      }}
    >
      <Text className="text-2xl mb-4" weight={FontWeight.Semibold}>
        Account
      </Text>
      <PasswordAccess
        email={user.email}
        methods={methods}
        loadFailed={signIn.loadFailed}
      />

      <Text className="mt-6 mb-2" weight={FontWeight.Medium}>
        Connected accounts
      </Text>
      {!methods ? (
        signIn.loadFailed ? (
          <View className="flex-row items-center justify-between gap-3">
            <Text className="flex-1 text-sm text-red-700">
              Couldn&apos;t load your connected accounts.
            </Text>
            <Button
              onPress={() => void reload()}
              title="Try again"
              color={ButtonColor.Red}
              size={ButtonSize.Small}
            />
          </View>
        ) : (
          <Text className="text-sm text-zinc-500">Loading...</Text>
        )
      ) : (
        <View className="gap-4">
          {Object.values(OAuthProvider).map((provider) => {
            const label = OAUTH_PROVIDER_LABEL[provider];
            const account = methods.accounts[provider];
            const removable = canDisconnect(methods, provider);
            return (
              <View key={provider}>
                <View className="flex-row items-center gap-3">
                  <OAuthProviderIcon provider={provider} />
                  <View className="flex-1">
                    <Text weight={FontWeight.Medium}>{label}</Text>
                    {account && (
                      <Text className="text-sm text-zinc-500" numberOfLines={1}>
                        {account.email}
                      </Text>
                    )}
                  </View>
                  {account ? (
                    <Button
                      color={ButtonColor.White}
                      size={ButtonSize.Small}
                      disabled={locked || !removable}
                      onPress={() => disconnect(provider)}
                      title="Disconnect"
                      accessibilityLabel={`Disconnect ${label}`}
                    />
                  ) : (
                    <Button
                      color={ButtonColor.White}
                      size={ButtonSize.Small}
                      disabled={locked}
                      onPress={() => void connect(provider)}
                      accessibilityLabel={`${connecting === provider ? "Connecting" : "Connect"} ${label}`}
                      title={
                        connecting === provider ? "Connecting..." : "Connect"
                      }
                    />
                  )}
                </View>
                {account && !removable && (
                  <Text className="text-sm text-zinc-500 mt-1">
                    {disconnectAccount.onlyWayIn(label)}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}
      <FeedbackLine
        feedback={
          signIn.disconnectError
            ? { ok: false, message: signIn.disconnectError }
            : feedback
        }
      />
    </Card>
  );
}
