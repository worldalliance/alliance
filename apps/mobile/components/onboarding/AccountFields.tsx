import { OAUTH_PROVIDER_LABEL, OAuthProvider } from "@alliance/common/oauth";
import type { ReferrerProfileDto } from "@alliance/shared/client";
import { forgotPassword as forgotPasswordCopy } from "@alliance/shared/lib/copy";
import { ArrowRight } from "lucide-react-native";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { FailureTone, type ProviderFailure } from "../../lib/oauthResult";
import { ACCOUNT_HEADING, AccountMode } from "../../lib/onboarding/flow";
import {
  motion,
  onboardingColors,
  useOnboardingScale,
} from "../../lib/onboarding/scale";
import ProfileImage from "../ProfileImage";
import Button, { ButtonColor, ButtonSize } from "../system/Button";
import OAuthProviderIcon from "../system/OAuthProviderIcon";
import PasswordVisibilityToggle from "../system/PasswordVisibilityToggle";
import Text, { FontWeight } from "../system/Text";

const EMAIL_PATTERN = /\S+@\S+\.\S+/;

/** Apple's button guidelines ask for it above the other providers'. */
const PROVIDER_RANK: Record<OAuthProvider, number> = {
  [OAuthProvider.Apple]: 0,
  [OAuthProvider.Google]: 1,
};

const PROVIDERS = Object.values(OAuthProvider).sort(
  (a, b) => PROVIDER_RANK[a] - PROVIDER_RANK[b],
);

const FAILURE_INK: Record<FailureTone, string> = {
  [FailureTone.Notice]: "text-white/80",
  [FailureTone.Error]: "text-red-300",
};

const FIELD =
  "min-h-12 rounded-lg border border-white/40 bg-white/12 px-3.5 text-base text-white";

export function AccountFields({
  mode,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  onSubmit,
  error,
  notice,
  submitting,
  onForgotPassword,
  pendingProvider,
  providerFailure,
  onContinueWithProvider,
  inviteUsed,
  inviter,
  onFieldFocus,
  onFieldBlur,
}: {
  mode: AccountMode;
  email: string;
  onEmailChange: (email: string) => void;
  password: string;
  onPasswordChange: (password: string) => void;
  onSubmit: () => void;
  error: string | null;
  notice: string | null;
  submitting: boolean;
  onForgotPassword: () => void;
  pendingProvider: OAuthProvider | null;
  providerFailure: ProviderFailure | null;
  onContinueWithProvider: (provider: OAuthProvider) => void;
  inviteUsed: boolean;
  inviter: ReferrerProfileDto | null;
  /** Both fields report focus, so the keyboard handling can tell a swap from a dismissal. */
  onFieldFocus: () => void;
  onFieldBlur: () => void;
}) {
  const scale = useOnboardingScale();
  const [showPassword, setShowPassword] = useState(false);

  const loggingIn = mode === AccountMode.LogIn;
  const showForm = loggingIn || !inviteUsed;
  const emailValid = EMAIL_PATTERN.test(email.trim());
  const ready = emailValid && password.length > 0;
  const busy = submitting || pendingProvider !== null;
  const heading =
    !loggingIn && inviteUsed
      ? "This invite link has already been used."
      : ACCOUNT_HEADING[mode];

  return (
    <Animated.View
      entering={FadeInDown.duration(motion.riseMs)}
      className="gap-2.5 px-4"
      testID="vr-onboarding-account-ready"
    >
      <Text
        weight={FontWeight.Semibold}
        className="text-white"
        style={{ fontSize: scale.h1, lineHeight: scale.h1 * 1.2 }}
      >
        {heading}
      </Text>

      {inviter && (
        <View className="flex-row items-center gap-x-2">
          <ProfileImage pfp={inviter.profilePicture} size="small" />
          <Text className="text-white/80" style={{ fontSize: scale.caption }}>
            <Text
              weight={FontWeight.Medium}
              className="text-white"
              style={{ fontSize: scale.caption }}
            >
              {inviter.displayName}
            </Text>{" "}
            invited you to the Alliance
          </Text>
        </View>
      )}

      {showForm && (
        <>
          {loggingIn && (
            <>
              {PROVIDERS.map((provider) => (
                <Button
                  key={provider}
                  color={ButtonColor.White}
                  size={ButtonSize.Custom}
                  className="min-h-12 gap-2.5 rounded-lg border-transparent py-3.5"
                  onPress={() => onContinueWithProvider(provider)}
                  disabled={busy}
                  loading={pendingProvider === provider}
                >
                  <OAuthProviderIcon provider={provider} />
                  <Text
                    weight={FontWeight.Medium}
                    className="text-zinc-900"
                    style={{ fontSize: scale.button }}
                  >
                    Continue with {OAUTH_PROVIDER_LABEL[provider]}
                  </Text>
                </Button>
              ))}

              {providerFailure && (
                <Text
                  className={FAILURE_INK[providerFailure.tone]}
                  weight={FontWeight.Medium}
                  style={{ fontSize: scale.caption }}
                  accessibilityRole="alert"
                >
                  {providerFailure.message}
                </Text>
              )}

              <View className="flex-row items-center gap-3 py-1">
                <View className="h-px flex-1 bg-white/40" />
                <Text
                  className="text-white/80"
                  style={{ fontSize: scale.caption }}
                >
                  or continue with email
                </Text>
                <View className="h-px flex-1 bg-white/40" />
              </View>
            </>
          )}

          <TextInput
            className={FIELD}
            placeholder="Email"
            placeholderTextColor="rgba(255,255,255,0.65)"
            value={email}
            onChangeText={onEmailChange}
            textContentType="username"
            autoComplete="email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Email"
            onFocus={onFieldFocus}
            onBlur={onFieldBlur}
          />

          <View className="flex-row items-center rounded-lg border border-white/40 bg-white/12 px-3.5">
            <TextInput
              className="min-h-12 flex-1 text-base text-white"
              placeholder="Password"
              placeholderTextColor="rgba(255,255,255,0.65)"
              value={password}
              onChangeText={onPasswordChange}
              secureTextEntry={!showPassword}
              textContentType={loggingIn ? "password" : "newPassword"}
              autoComplete={loggingIn ? "current-password" : "new-password"}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Password"
              onFocus={onFieldFocus}
              onBlur={onFieldBlur}
            />
            <PasswordVisibilityToggle
              visible={showPassword}
              onPress={() => setShowPassword((current) => !current)}
            />
          </View>

          {error && (
            <Text
              className="text-red-300"
              weight={FontWeight.Medium}
              style={{ fontSize: scale.caption }}
              accessibilityRole="alert"
            >
              {error}
            </Text>
          )}
          {notice && (
            <Text className="text-white/80" style={{ fontSize: scale.caption }}>
              {notice}
            </Text>
          )}

          <Button
            color={ButtonColor.White}
            size={ButtonSize.Custom}
            className="min-h-12 gap-2 rounded-lg border-transparent py-3.5"
            onPress={onSubmit}
            disabled={!ready || busy}
            loading={submitting}
            testID="vr-onboarding-account-submit"
          >
            <Text
              weight={FontWeight.Medium}
              style={{
                color: onboardingColors.panelGreen,
                fontSize: scale.button,
              }}
            >
              {loggingIn ? "Log in" : "Continue"}
            </Text>
            <ArrowRight size={16} color={onboardingColors.panelGreen} />
          </Button>
        </>
      )}

      {loggingIn && (
        <View className="flex-row items-center gap-4">
          <Pressable onPress={onForgotPassword} disabled={busy}>
            <Text
              className="text-white/80 underline"
              style={{ fontSize: scale.caption }}
            >
              {forgotPasswordCopy.prompt}
            </Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}
