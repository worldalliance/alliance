import type { KindSettingsDto } from "@alliance/shared/client";
import {
  cellStatus,
  CHANNEL_LABEL,
  choiceOf,
  kindChannelLabel,
  kindSummary,
  OVERRIDE_CHOICE_LABEL,
  OVERRIDE_CHOICE_VALUE,
  OVERRIDE_CHOICES,
  REQUIRED_KIND_NOTE,
  RESET_KIND,
} from "@alliance/shared/lib/notificationSettings";
import type { SettingsControls } from "@alliance/shared/lib/useNotificationSettings";
import { ChevronDown, ChevronUp, Lock } from "lucide-react-native";
import { useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { colors } from "../../lib/style/colors";
import { SegmentedTabs } from "../system/SegmentedTabs";
import Text, { FontWeight } from "../system/Text";
import SaveState from "./SaveState";

type Props = SettingsControls & { kind: KindSettingsDto };

export default function NotificationKindRow({
  kind,
  save,
  retry,
  statusOf,
  shownOverride,
  resetOf,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const reset = resetOf(kind);
  const Chevron = expanded ? ChevronUp : ChevronDown;

  return (
    <View className="border-b border-zinc-200">
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((open) => !open)}
        className="flex-row items-center justify-between gap-3 py-3"
      >
        <View className="flex-1">
          <Text className="text-base text-zinc-900" weight={FontWeight.Medium}>
            {kind.label}
          </Text>
          <Text className="text-sm text-zinc-500">{kindSummary(kind)}</Text>
        </View>
        <Chevron size={18} color={colors.text.light} />
      </TouchableOpacity>
      {expanded && (
        <View className="gap-3 pb-4">
          <View className="rounded-lg bg-zinc-100 px-3 py-2">
            <Text className="text-sm text-zinc-700">{kind.example}</Text>
          </View>
          {kind.required && (
            <View className="flex-row items-center gap-1">
              <Lock size={14} color={colors.text.light} />
              <Text className="text-sm text-zinc-500">
                {REQUIRED_KIND_NOTE}
              </Text>
            </View>
          )}
          {kind.cells.map((cell) => {
            const target = {
              type: "cell" as const,
              kind: kind.kind,
              channel: cell.channel,
            };
            const selected = choiceOf(shownOverride(kind.kind, cell));
            return (
              <View key={cell.channel} className="gap-1">
                <View className="flex-row items-center justify-between">
                  <Text className="text-base text-zinc-900">
                    {CHANNEL_LABEL[cell.channel]}
                  </Text>
                  <SaveState
                    status={statusOf(target)}
                    onRetry={() => retry(target)}
                  />
                </View>
                <Text className="text-sm text-zinc-500">
                  {cellStatus(cell)}
                </Text>
                {cell.editable && (
                  <SegmentedTabs
                    tabs={OVERRIDE_CHOICES}
                    selectedTab={selected}
                    labels={OVERRIDE_CHOICE_LABEL}
                    accessibilityLabel={kindChannelLabel(kind, cell.channel)}
                    onSelect={(choice) =>
                      choice !== selected &&
                      save([
                        { ...target, value: OVERRIDE_CHOICE_VALUE[choice] },
                      ])
                    }
                  />
                )}
              </View>
            );
          })}
          {reset.length > 0 && (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => save(reset)}
            >
              <Text className="text-sm text-zinc-600 underline">
                {RESET_KIND}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
