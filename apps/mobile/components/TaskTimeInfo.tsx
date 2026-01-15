import {
  deadlineColor,
  formatDeadline,
  TaskTimeInfoPropsShared,
} from "@alliance/shared/lib/taskTimeInfo";
import { View } from "react-native";
import Text from "./system/Text";
import { ClockIcon, Calendar } from "lucide-react-native";

const TaskTimeInfo = ({
  action,
  nextEvent,
  lastEvent,
  absoluteDeadline,
  className,
}: TaskTimeInfoPropsShared & { className?: string }) => {
  const color = deadlineColor(nextEvent, action);

  return (
    <View className={`${className}`}>
      {!!action.timeEstimate && action.status !== "gathering_commitments" ? (
        <View className="flex-row items-center gap-x-2">
          <ClockIcon size={19} color="rgb(98, 161, 36)" />
          <Text className="text-green text-base">
            {action.timeEstimate} minute{action.timeEstimate === 1 ? "" : "s"}
          </Text>
        </View>
      ) : null}
      {!!nextEvent ? (
        <View className="flex-row items-center gap-x-1">
          <Calendar size={16} color={color} />
          <Text style={{ color: color }}>{formatDeadline(nextEvent.date)}</Text>
        </View>
      ) : null}
    </View>
  );
};

export default TaskTimeInfo;
