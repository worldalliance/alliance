import { SourceHistoriesStatus } from "@alliance/shared/forms/useVariableSourceHistories";
import type { VariableInputsGate } from "@alliance/shared/forms/variableInputsGate";
import {
  sourceAnswersLoadFailed,
  variableSourceDeleted,
} from "@alliance/shared/lib/copy";
import { RotateCw } from "lucide-react-native";
import type { ReactElement } from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { colors } from "../../lib/style/colors";
import Text from "../system/Text";

/**
 * What a form renders in place of itself until what its variables load is
 * ready. A read-only form reading a deleted form or question still shows,
 * with the variables reading it unresolved.
 */
export function variableInputsGateView(params: {
  gate: VariableInputsGate;
  readOnly: boolean;
}): ReactElement | null {
  const { gate, readOnly } = params;
  switch (gate.status) {
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
            onPress={gate.retry}
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
    case SourceHistoriesStatus.SourceDeleted:
      if (readOnly) return null;
      return (
        <View className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <Text className="text-sm text-amber-800">
            {variableSourceDeleted}
          </Text>
        </View>
      );
    case SourceHistoriesStatus.Ready:
      return null;
    default:
      throw new Error(
        `unknown variable inputs status: ${gate satisfies never}`,
      );
  }
}
