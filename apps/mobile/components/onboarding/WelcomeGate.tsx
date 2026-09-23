import type { OAuthProvider } from "@alliance/common/oauth";
import type { ReferrerProfileDto } from "@alliance/shared/client";
import { Image } from "expo-image";
import { memo, useEffect, useRef } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { KeyboardEvents } from "react-native-keyboard-controller";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import type { ProviderFailure } from "../../lib/oauthResult";
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
 * Pinned to the top at a fixed height, outside the keyboard-avoiding subtree,
 * so the keyboard moves the form over a photo that holds still. Memoised
 * because moving between the two fields re-renders the form, and re-rendering
 * the SVG scrim with it flashes the whole backdrop.
 */
const Backdrop = memo(function Backdrop({ height }: { height: number }) {
  return (
    <View
      style={{ position: "absolute", top: 0, left: 0, right: 0, height }}
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
  );
});

/** Long enough for a tap on one field to land as focus on the next. */
const FOCUS_SWAP_MS = 120;

/**
 * How far the keyboard covers the screen, ignoring what it does while focus is
 * moving between fields.
 *
 * iOS swaps the keyboard rather than keeping it up when the next field asks for
 * a different one, which the email and password fields do. That reports a hide
 * and then a show, and obeying the hide dips the form and bounces it back. The
 * fields say whether any of them still holds focus, so the tear-down is only
 * believed once none of them does, and the inset only ever rises while one of
 * them does. Between them the handover moves nothing at all.
 */
function useKeyboardInset() {
  const inset = useSharedValue(0);
  const focusedFields = useRef(0);

  useEffect(() => {
    let collapse: ReturnType<typeof setTimeout> | undefined;

    const show = KeyboardEvents.addListener("keyboardWillShow", (event) => {
      clearTimeout(collapse);
      // A swap can report a shorter keyboard than the one it replaced, when the
      // two fields differ over an autofill bar. Holding the taller of the two
      // leaves a little dead space under the form and moves nothing.
      const height =
        focusedFields.current > 0
          ? Math.max(event.height, inset.value)
          : event.height;
      inset.value = withTiming(height, { duration: event.duration });
    });
    const hide = KeyboardEvents.addListener("keyboardWillHide", (event) => {
      clearTimeout(collapse);
      collapse = setTimeout(() => {
        if (focusedFields.current > 0) return;
        inset.value = withTiming(0, { duration: event.duration });
      }, FOCUS_SWAP_MS);
    });

    return () => {
      clearTimeout(collapse);
      show.remove();
      hide.remove();
    };
  }, [inset]);

  return {
    inset,
    onFieldFocus: () => {
      focusedFields.current += 1;
    },
    onFieldBlur: () => {
      focusedFields.current = Math.max(focusedFields.current - 1, 0);
    },
  };
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
  pendingProvider,
  providerFailure,
  onContinueWithProvider,
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
  pendingProvider: OAuthProvider | null;
  providerFailure: ProviderFailure | null;
  onContinueWithProvider: (provider: OAuthProvider) => void;
  inviteUsed: boolean;
  inviter: ReferrerProfileDto | null;
}) {
  const insets = useSafeAreaInsets();
  const scale = useOnboardingScale();
  const viewportHeight = useViewportHeight();
  const { inset, onFieldFocus, onFieldBlur } = useKeyboardInset();

  const padTop = insets.top + scale.gateTop;
  const padBottom = insets.bottom + 16;
  const contentStyle = useAnimatedStyle(() => ({
    paddingTop: padTop,
    paddingBottom: padBottom + inset.value,
  }));

  return (
    <View className="flex-1" testID="vr-onboarding-gate-ready">
      <Backdrop height={viewportHeight} />

      <Animated.View className="flex-1 justify-between" style={contentStyle}>
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
          pendingProvider={pendingProvider}
          providerFailure={providerFailure}
          onContinueWithProvider={onContinueWithProvider}
          inviteUsed={inviteUsed}
          inviter={inviter}
          onFieldFocus={onFieldFocus}
          onFieldBlur={onFieldBlur}
        />
      </Animated.View>
    </View>
  );
}
