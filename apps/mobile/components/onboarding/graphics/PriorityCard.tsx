import { Image } from "expo-image";
import { View } from "react-native";
import type { Priority } from "../../../lib/onboarding/content";
import {
  onboardingColors,
  useOnboardingScale,
} from "../../../lib/onboarding/scale";
import Text from "../../system/Text";

/** The site's panel tint, which alternates with navy down the row of cards. */
const PANEL = "#0d2c5c";

/**
 * The public site opens every description on hover. These cards are too short
 * for that, so the Figma shows the titles alone.
 */
export function PriorityCard({
  priority,
  index,
}: {
  priority: Priority;
  index: number;
}) {
  const scale = useOnboardingScale();

  return (
    <View
      className="flex-1 overflow-hidden rounded-lg"
      style={{
        backgroundColor: index % 2 === 0 ? onboardingColors.navy : PANEL,
      }}
    >
      <Image
        source={priority.image}
        style={{ position: "absolute", inset: 0, opacity: 0.52 }}
        contentFit="cover"
        tintColor={undefined}
      />
      <View className="absolute top-[18px] left-4 h-[1.5px] w-[46px] bg-white/90" />
      <View className="mt-auto p-4">
        <Text
          className="text-white"
          style={{ fontSize: scale.h2, lineHeight: scale.h2 * 1.16 }}
        >
          {priority.title}
        </Text>
      </View>
    </View>
  );
}
