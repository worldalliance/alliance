import {
  RETRY_SAVE,
  SAVE_STATUS_COPY,
  SaveStatus,
} from "@alliance/shared/lib/useNotificationSettings";
import { Check } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { colors } from "../../lib/style/colors";
import { useAnnounceOnIos } from "../../lib/useAnnounceOnIos";
import Text from "../system/Text";

type Props = { status: SaveStatus | null; onRetry: () => void };

export default function SaveState({ status, onRetry }: Props) {
  useAnnounceOnIos(
    status === SaveStatus.Failed ? SAVE_STATUS_COPY[status] : null,
  );
  return (
    <View accessibilityLiveRegion="polite">
      <SaveStateText status={status} onRetry={onRetry} />
    </View>
  );
}

function SaveStateText({ status, onRetry }: Props) {
  switch (status) {
    case null:
      return null;
    case SaveStatus.Saving:
      return (
        <Text className="text-sm text-zinc-500">
          {SAVE_STATUS_COPY[status]}
        </Text>
      );
    case SaveStatus.Saved:
      return (
        <View className="flex-row items-center gap-1">
          <Check size={14} color={colors.text.light} />
          <Text className="text-sm text-zinc-500">
            {SAVE_STATUS_COPY[status]}
          </Text>
        </View>
      );
    case SaveStatus.Failed:
      return (
        <View className="flex-row items-center gap-1">
          <Text className="text-sm text-red-600">
            {SAVE_STATUS_COPY[status]}
          </Text>
          <Pressable accessibilityRole="button" onPress={onRetry} hitSlop={8}>
            <Text className="text-sm text-red-600 underline">{RETRY_SAVE}</Text>
          </Pressable>
        </View>
      );
    default:
      throw new Error(`unknown save status: ${status satisfies never}`);
  }
}
