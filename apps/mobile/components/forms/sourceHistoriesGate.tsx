import {
  SourceHistoriesStatus,
  type SourceHistories,
} from "@alliance/shared/forms/useVariableSourceHistories";
import { sourceAnswersLoadFailed } from "@alliance/shared/lib/copy";
import { RotateCw } from "lucide-react-native";
import type { ReactElement } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { colors } from "../../lib/style/colors";
import Text from "../system/Text";

/** What a form renders in place of itself until its source histories are ready. */
export function sourceHistoriesGate(
  histories: SourceHistories,
): ReactElement | null {
  switch (histories.status) {
    case SourceHistoriesStatus.Loading:
      return (
        <View className="items-center py-8">
          <ActivityIndicator color={colors.green} />
        </View>
      );
    case SourceHistoriesStatus.Failed:
      return (
        <View className="flex-row items-center gap-x-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <Text className="flex-1 text-sm text-amber-800">
            {sourceAnswersLoadFailed}
          </Text>
          <TouchableOpacity
            onPress={histories.retry}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            className="p-1"
          >
            {/* amber-800 */}
            <RotateCw size={16} color="#92400e" />
          </TouchableOpacity>
        </View>
      );
    case SourceHistoriesStatus.Ready:
      return null;
    default:
      throw new Error(
        `unknown source histories status: ${histories satisfies never}`,
      );
  }
}
