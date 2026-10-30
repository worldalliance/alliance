import { FlowButtonKind } from "@alliance/shared/forms/flowStyle";
import { taskFlow, withdrawFromAction } from "@alliance/shared/lib/copy";
import { Ellipsis, X } from "lucide-react-native";
import { View } from "react-native";
import { colors } from "../../lib/style/colors";
import Text from "../system/Text";
import FlowButton from "./FlowButton";

export function TaskFlowWithdrawButton({ onPress }: { onPress: () => void }) {
  return (
    <FlowButton
      kind={FlowButtonKind.Icon}
      onPress={onPress}
      accessibilityLabel={withdrawFromAction}
      hitSlop={8}
    >
      <Ellipsis size={20} color={colors.text.icon} />
    </FlowButton>
  );
}

export default function TaskFlowHeader({
  onClose,
  disabled,
  progressSaved,
  onWithdraw,
}: {
  onClose: () => void;
  disabled: boolean;
  progressSaved: boolean;
  onWithdraw: (() => void) | null;
}) {
  return (
    <View className="flex-row items-center justify-between px-4 py-2">
      <View className="flex-row items-center gap-x-3">
        <FlowButton
          kind={FlowButtonKind.Icon}
          onPress={onClose}
          disabled={disabled}
          accessibilityLabel={taskFlow.closeTask}
          hitSlop={8}
        >
          <X size={20} color={colors.text.icon} />
        </FlowButton>
        {progressSaved ? (
          <Text className="text-sm text-zinc-500">
            {taskFlow.progressSaved}
          </Text>
        ) : null}
      </View>
      {onWithdraw ? <TaskFlowWithdrawButton onPress={onWithdraw} /> : null}
    </View>
  );
}
