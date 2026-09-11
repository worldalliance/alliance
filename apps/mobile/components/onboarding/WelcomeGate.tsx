import { OAuthProvider } from "@alliance/common/oauth";
import type { ReferrerProfileDto } from "@alliance/shared/client";
import { Image } from "expo-image";
import { View } from "react-native";
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

export function WelcomeGate({
  mode,
  onModeChange,
  email,
  onEmailChange,
  password,
  onPasswordChange,
  onSubmit,
  onProviderPress,
  providerBusy,
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
  onProviderPress: (provider: OAuthProvider) => void;
  providerBusy: OAuthProvider | null;
  error: string | null;
  notice: string | null;
  submitting: boolean;
  onForgotPassword: () => void;
  inviteUsed: boolean;
  inviter: ReferrerProfileDto | null;
}) {
  const insets = useSafeAreaInsets();
  const scale = useOnboardingScale();

  return (
    <View className="flex-1" testID="vr-onboarding-gate-ready">
      <Image
        source={WELCOME_IMAGE}
        style={{ position: "absolute", inset: 0 }}
        contentFit="cover"
        contentPosition="center"
      />
      <Scrim />

      <View
        className="flex-1 justify-between"
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

        <AccountFields
          mode={mode}
          onModeChange={onModeChange}
          email={email}
          onEmailChange={onEmailChange}
          password={password}
          onPasswordChange={onPasswordChange}
          onSubmit={onSubmit}
          onProviderPress={onProviderPress}
          providerBusy={providerBusy}
          error={error}
          notice={notice}
          submitting={submitting}
          onForgotPassword={onForgotPassword}
          inviteUsed={inviteUsed}
          inviter={inviter}
        />
      </View>
    </View>
  );
}
