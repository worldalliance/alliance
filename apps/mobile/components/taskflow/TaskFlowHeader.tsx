import { FlowButtonKind } from "@alliance/shared/forms/flowStyle";
import { taskFlow, withdrawFromAction } from "@alliance/shared/lib/copy";
import { Ellipsis, X } from "lucide-react-native";
import { View } from "react-native";
import { colors } from "../../lib/style/colors";
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
  onWithdraw,
}: {
  onClose: () => void;
  disabled: boolean;
  onWithdraw: (() => void) | null;
}) {
  return (
    <View className="flex-row items-center justify-between px-4 py-2">
      <FlowButton
        kind={FlowButtonKind.Icon}
        onPress={onClose}
        disabled={disabled}
        accessibilityLabel={taskFlow.closeTask}
        hitSlop={8}
      >
        <X size={20} color={colors.text.icon} />
      </FlowButton>
      {onWithdraw ? <TaskFlowWithdrawButton onPress={onWithdraw} /> : null}
    </View>
  );
}
