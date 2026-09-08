import { Image } from "expo-image";
import { Pressable, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  MEMBERS_PHOTO,
  WELCOME_HEADLINE,
  WELCOME_SUBLINE,
} from "../../lib/onboarding/content";
import {
  onboardingColors,
  useOnboardingScale,
} from "../../lib/onboarding/scale";
import Text, { FontFamily } from "../system/Text";

export function MemberWelcomeBackdrop() {
  return (
    <>
      <Image
        source={MEMBERS_PHOTO}
        style={{ position: "absolute", inset: 0 }}
        contentFit="cover"
      />
      <View
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: onboardingColors.photoWash,
          opacity: 0.75,
        }}
      />
    </>
  );
}

export function MemberWelcomeStep({
  memberNumber,
  onContinue,
}: {
  memberNumber: number;
  onContinue: () => void;
}) {
  const scale = useOnboardingScale();

  return (
    <Pressable
      onPress={onContinue}
      accessibilityLabel="Continue"
      className="flex-1 items-center justify-center gap-2 px-6"
      testID="vr-onboarding-welcome-ready"
    >
      <Animated.View entering={FadeInDown.delay(240).duration(720)}>
        <Text
          family={FontFamily.Serif}
          className="text-center text-white"
          style={{ fontSize: scale.h1, lineHeight: scale.h1 * 1.2 }}
        >
          {WELCOME_HEADLINE}
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(410).duration(720)}>
        <Text
          className="text-center text-white"
          style={{ fontSize: scale.body }}
        >
          {WELCOME_SUBLINE}
        </Text>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(620).duration(720)}>
        <Text
          className="mt-3 text-center text-white"
          style={{ fontSize: scale.h2, lineHeight: scale.h2 * 1.3 }}
        >
          You are member {memberNumber.toLocaleString("en-US")}. We’re glad
          you’re here.
        </Text>
      </Animated.View>
    </Pressable>
  );
}
