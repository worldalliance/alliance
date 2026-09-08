import { Image } from "expo-image";
import { ChevronRight, Clock } from "lucide-react-native";
import { View } from "react-native";
import {
  TimelineEntryKind,
  type ActionExample,
  type TimelineEntry,
} from "../../../lib/onboarding/actionExamples";
import { onboardingColors } from "../../../lib/onboarding/scale";
import { colors } from "../../../lib/style/colors";
import Text, { FontFamily, FontWeight } from "../../system/Text";

const SITE_INK = "#111";

function FaceRow({ faces }: { faces: ActionExample["faces"] }) {
  return (
    <View className="flex-row gap-0.5">
      {faces.map((face, i) => (
        <Image
          key={i}
          source={face}
          style={{ width: 22, height: 22, borderRadius: 4 }}
          contentFit="cover"
        />
      ))}
    </View>
  );
}

function CompletedBlock({ action }: { action: ActionExample }) {
  const percentage = Math.round((action.completed / action.expected) * 100);

  return (
    <View className="mt-2 rounded-md border border-zinc-200 p-3">
      <View className="mb-1 flex-row items-center justify-between gap-2">
        <Text className="text-[11px] text-zinc-600">
          {action.completed} / {action.expected} members completed
        </Text>
        <FaceRow faces={action.faces} />
      </View>
      <View className="h-2 overflow-hidden rounded-full bg-zinc-200">
        <View
          className="h-full rounded-full"
          style={{
            width: `${percentage}%`,
            backgroundColor: onboardingColors.accentGreen,
          }}
        />
      </View>
    </View>
  );
}

function Entry({
  entry,
  highlighted,
}: {
  entry: TimelineEntry;
  highlighted: boolean;
}) {
  if (entry.kind === TimelineEntryKind.Update) {
    return (
      <View className="overflow-hidden rounded border border-zinc-200">
        <View className="border-b border-zinc-200 bg-zinc-50 px-3 py-2">
          <Text className="text-[11px]" weight={FontWeight.Semibold}>
            <Text
              className="text-[11px]"
              weight={FontWeight.Semibold}
              style={{ color: onboardingColors.accentGreen }}
            >
              Update:{" "}
            </Text>
            {entry.title}{" "}
            <Text className="text-[11px] text-zinc-500">{entry.time}</Text>
          </Text>
        </View>
        <Text className="bg-white px-3 py-2 text-[11px] leading-[16px] text-zinc-700">
          {entry.body}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-baseline gap-2">
      <Text
        className="text-[11px]"
        weight={FontWeight.Medium}
        style={{
          color: highlighted ? onboardingColors.accentGreen : SITE_INK,
        }}
      >
        {entry.title}
      </Text>
      <Text className="text-[10px] text-zinc-500">{entry.time}</Text>
    </View>
  );
}

/**
 * An action laid out the way the real action card lays one out — title, then
 * the time estimate, then the description and timeline — from authored content
 * rather than the API.
 */
export function ActionExampleCard({ action }: { action: ActionExample }) {
  return (
    <View className="flex-1 overflow-hidden rounded-lg bg-white p-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="min-w-0 flex-1 gap-1">
          <Text
            family={FontFamily.Serif}
            weight={FontWeight.Medium}
            className="text-[15px] leading-[18px]"
            style={{ color: SITE_INK }}
          >
            {action.title}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <Clock size={13} color={onboardingColors.accentGreen} />
            <Text
              className="text-[11px]"
              style={{ color: onboardingColors.accentGreen }}
            >
              {action.minutes} minutes
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-0.5 rounded bg-zinc-100 px-2 py-1">
          <Text className="text-[10px] text-black">Details</Text>
          <ChevronRight size={11} color={colors.text.primary} />
        </View>
      </View>

      <Text className="mt-2.5 text-[11px] leading-[16px] text-zinc-600">
        {action.description}
      </Text>

      <Text
        className="mt-3.5 mb-2 text-[11px]"
        weight={FontWeight.Semibold}
        style={{ color: SITE_INK }}
      >
        Timeline
      </Text>

      <View className="gap-2">
        {action.timeline.map((entry, i) => (
          <View key={entry.title} className="flex-row gap-2">
            <View className="items-center pt-1">
              <View
                className="size-[9px] rounded-full"
                style={{
                  backgroundColor:
                    i === 0 ? onboardingColors.accentGreen : colors.borderLight,
                }}
              />
              {i < action.timeline.length - 1 && (
                <View className="w-px flex-1 bg-zinc-200" />
              )}
            </View>
            <View className="flex-1">
              <Entry entry={entry} highlighted={i === 0} />
              {i === action.barAtIndex && <CompletedBlock action={action} />}
            </View>
          </View>
        ))}
      </View>

      <View className="mt-4 min-h-0 flex-1 gap-2 overflow-hidden">
        {action.body.map((block) => (
          <View key={block.text} className="gap-1">
            {block.heading && (
              <Text
                className="text-[11px]"
                weight={FontWeight.Semibold}
                style={{ color: SITE_INK }}
              >
                {block.heading}
              </Text>
            )}
            <Text className="text-[11px] leading-[16px] text-zinc-600">
              {block.text}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
