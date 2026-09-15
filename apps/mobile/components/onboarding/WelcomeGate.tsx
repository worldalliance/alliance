import type { ReferrerProfileDto } from "@alliance/shared/client";
import { Image } from "expo-image";
import { useRef } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import {
  GATE_SUBLINE,
  GATE_TITLE,
  WELCOME_IMAGE,
} from "../../lib/onboarding/content";
import { AccountMode } from "../../lib/onboarding/flow";
import {
  onboardingColors,
  useOnboardingScale,
} from "../../lib/onboarding/scale";
import Text, { FontFamily, FontWeight } from "../system/Text";
import { AccountFields } from "./AccountFields";

/**
 * The photo is a bright field, so white type needs its own ground at both
 * ends. An SVG gradient rather than stacked opacities, which band, and rather
 * than a native gradient module, which would invalidate every installed dev
 * client's fingerprint.
 */
function Scrim() {
  return (
    <Svg style={{ position: "absolute", inset: 0 }} width="100%" height="100%">
      <Defs>
        <LinearGradient id="ob-scrim" x1="0" y1="0" x2="0" y2="1">
          <Stop
            offset="0"
            stopColor={onboardingColors.panelGreen}
            stopOpacity="0.92"
          />
          <Stop
            offset="0.3"
            stopColor={onboardingColors.panelGreen}
            stopOpacity="0.42"
          />
          <Stop
            offset="0.66"
            stopColor={onboardingColors.panelGreen}
            stopOpacity="0.5"
          />
          <Stop
            offset="1"
            stopColor={onboardingColors.panelGreen}
            stopOpacity="0.94"
          />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill="url(#ob-scrim)" />
    </Svg>
  );
}

/**
 * The window height with the keyboard down. Android resizes the window when the
 * keyboard opens, and the photo behind the form must not resize with it.
 */
function useViewportHeight() {
  const { width, height } = useWindowDimensions();
  const viewport = useRef({ width, height });

  if (viewport.current.width !== width) {
    viewport.current = { width, height };
  } else if (height > viewport.current.height) {
    viewport.current = { width, height };
  }

  return viewport.current.height;
}

export function WelcomeGate({
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
  inviteUsed,
  inviter,
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
  inviteUsed: boolean;
  inviter: ReferrerProfileDto | null;
}) {
  const insets = useSafeAreaInsets();
  const scale = useOnboardingScale();
  const viewportHeight = useViewportHeight();

  return (
    <View className="flex-1" testID="vr-onboarding-gate-ready">
      {/* Pinned to the top at a fixed height, outside the keyboard-avoiding
          subtree, so the keyboard moves the form over a photo that holds still. */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: viewportHeight,
        }}
        pointerEvents="none"
      >
        <Image
          source={WELCOME_IMAGE}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="center"
        />
        <Scrim />
      </View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View
          className="flex-1"
          style={{
            paddingTop: insets.top + scale.gateTop,
            paddingBottom: insets.bottom + 16,
          }}
        >
          <Animated.View
            entering={FadeIn.delay(120).duration(760)}
            className="px-6"
          >
            <Text
              family={FontFamily.Serif}
              weight={FontWeight.Bold}
              className="text-center text-white"
              style={{ fontSize: scale.gateTitle }}
            >
              {GATE_TITLE}
            </Text>
            <Text
              className="mt-1.5 text-center text-white"
              style={{ fontSize: scale.gateSubline }}
            >
              {GATE_SUBLINE}
            </Text>
          </Animated.View>

          {/* Equal spacers rest the form midway rather than pinning it low. The
              email field takes focus on mount, and a bottom-pinned form has
              most of the screen to cross the moment the keyboard opens. */}
          <View className="flex-1" />

          <AccountFields
            mode={mode}
            email={email}
            onEmailChange={onEmailChange}
            password={password}
            onPasswordChange={onPasswordChange}
            onSubmit={onSubmit}
            error={error}
            notice={notice}
            submitting={submitting}
            onForgotPassword={onForgotPassword}
            inviteUsed={inviteUsed}
            inviter={inviter}
          />

          <View className="flex-1" />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
