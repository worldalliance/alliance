import type { ReferrerProfileDto } from "@alliance/shared/client";
import { forgotPassword as forgotPasswordCopy } from "@alliance/shared/lib/copy";
import { ArrowRight } from "lucide-react-native";
import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ACCOUNT_HEADING, AccountMode } from "../../lib/onboarding/flow";
import {
  motion,
  onboardingColors,
  useOnboardingScale,
} from "../../lib/onboarding/scale";
import ProfileImage from "../ProfileImage";
import Button, { ButtonColor, ButtonSize } from "../system/Button";
import PasswordVisibilityToggle from "../system/PasswordVisibilityToggle";
import Text, { FontWeight } from "../system/Text";

/** Matches the mobile signup screen's own check rather than pulling in a schema. */
const EMAIL_PATTERN = /\S+@\S+\.\S+/;

const FIELD =
  "min-h-12 rounded-lg border border-white/40 bg-white/12 px-3.5 text-base text-white";

export function AccountFields({
  mode,
  onModeChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  onSubmit,
  error,
  notice,
  submitting,
  onForgotPassword,
  inviteUsed,
  inviter,
}: {
  mode: AccountMode;
  onModeChange: (mode: AccountMode) => void;
  email: string;
  onEmailChange: (email: string) => void;
  password: string;
  onPasswordChange: (password: string) => void;
  onSubmit: () => void;
  error: string | null;
  notice: string | null;
  submitting: boolean;
  onForgotPassword: () => void;
  inviteUsed: boolean;
  inviter: ReferrerProfileDto | null;
}) {
  const scale = useOnboardingScale();
  const [showPassword, setShowPassword] = useState(false);

  const loggingIn = mode === AccountMode.LogIn;
  const showForm = loggingIn || !inviteUsed;
  const emailValid = EMAIL_PATTERN.test(email.trim());
  const ready = emailValid && password.length > 0;
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
            autoFocus
            accessibilityLabel="Email"
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
            disabled={!ready || submitting}
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

      <View className="flex-row items-center gap-4">
        <Pressable
          onPress={() =>
            onModeChange(loggingIn ? AccountMode.SignUp : AccountMode.LogIn)
          }
        >
          <Text
            className="text-white/80 underline"
            style={{ fontSize: scale.caption }}
          >
            {loggingIn ? "Create an account" : "I already have an account"}
          </Text>
        </Pressable>
        {loggingIn && (
          <Pressable onPress={onForgotPassword} disabled={submitting}>
            <Text
              className="text-white/80 underline"
              style={{ fontSize: scale.caption }}
            >
              {forgotPasswordCopy.prompt}
            </Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}
