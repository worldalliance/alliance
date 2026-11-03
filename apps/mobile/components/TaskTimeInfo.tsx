import { withCount } from "@alliance/common/plural";
import {
  deadlineColor,
  formatDeadline,
  TaskTimeInfoPropsShared,
} from "@alliance/shared/lib/taskTimeInfo";
import { formatTime } from "@alliance/shared/lib/utils";
import { cn } from "@alliance/shared/styles/util";
import { Calendar, ClockIcon } from "lucide-react-native";
import { View } from "react-native";
import { colors } from "../lib/style/colors";
import Text from "./system/Text";

const TaskTimeInfo = ({
  action,
  nextEvent,
  absoluteDeadline,
  className,
  filled = false,
}: TaskTimeInfoPropsShared & { className?: string; filled?: boolean }) => {
  const color = deadlineColor(nextEvent, action);
  const iconSize = filled ? 15 : 16;
  const textSize = filled ? "text-sm" : "text-base";

  return (
    <View className={cn(className)}>
      {!!action.timeEstimate ? (
        <View
          className={cn(
            "flex-row items-center",
            filled
              ? "gap-x-1 text-white bg-green rounded-full px-3 py-1"
              : "gap-x-1.5 text-green",
          )}
        >
          <ClockIcon
            size={iconSize}
            color={filled ? colors.white : colors.green}
          />
          <Text className={cn(textSize, filled ? "text-white" : "text-green")}>
            {withCount(action.timeEstimate, "minute")}
          </Text>
        </View>
      ) : null}
      {!!nextEvent ? (
        <View
          className={cn(
            "flex-row items-center",
            filled
              ? "gap-x-1 text-white rounded-full px-3 py-1 bg-zinc-100"
              : "gap-x-1.5 text-green",
          )}
        >
          <Calendar size={iconSize} color={color} />
          <Text className={textSize} style={{ color: color }}>
            {absoluteDeadline
              ? formatDeadline(nextEvent.date)
              : `${formatTime(new Date(nextEvent.date), { addSuffix: false })} left`}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

export default TaskTimeInfo;
