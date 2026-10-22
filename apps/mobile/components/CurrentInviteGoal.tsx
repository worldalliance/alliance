import type { AmbassadorInviteGoalWithStatsDto } from "@alliance/shared/client";
import { formatMediumDate } from "@alliance/shared/lib/dateFormatters";
import {
  inviteGoalProgressPercent,
  inviteGoalStatus,
  inviteGoalSummary,
} from "@alliance/shared/lib/inviteGoals";
import type { useInviteGoalForms } from "@alliance/shared/lib/useInviteGoalForms";
import { MoreHorizontal, Trash2 } from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";
import DatePickerField from "./forms/DatePickerField";
import Input from "./system/Input";
import Text, { FontWeight } from "./system/Text";

export function CurrentInviteGoal({
  currentGoal,
  goalForms,
  editGoalOpen,
  onToggleEditGoal,
  onDeleteGoal,
  isUpdatingGoal,
  isDeletingGoal,
}: {
  currentGoal: AmbassadorInviteGoalWithStatsDto;
  goalForms: ReturnType<typeof useInviteGoalForms>;
  editGoalOpen: boolean;
  onToggleEditGoal: () => void;
  onDeleteGoal: () => void;
  isUpdatingGoal: boolean;
  isDeletingGoal: boolean;
}) {
  const {
    editGoalStartDate,
    changeEditGoalStartDate,
    editGoalDueDate,
    changeEditGoalDueDate,
    editGoalTarget,
    setEditGoalTarget,
    saveEditGoalTarget,
    goalEditMessage,
  } = goalForms;
  const currentGoalProgressPercent = inviteGoalProgressPercent(currentGoal);

  return (
    <View
      className="rounded border p-4 gap-5"
      style={{
        backgroundColor: "rgba(255,255,255,0.10)",
        borderColor: "rgba(255,255,255,0.15)",
      }}
    >
      <View className="gap-3">
        <View className="flex-row items-start gap-3">
          <View className="flex-1">
            <Text className="text-lg text-white" weight={FontWeight.Semibold}>
              {inviteGoalSummary(inviteGoalStatus(currentGoal))
                .map((part) =>
                  typeof part === "string" ? part : part.emphasis,
                )
                .join("")}
            </Text>
            <Text className="text-sm text-white/70">
              {formatMediumDate(new Date(currentGoal.goal.startAt))} -{" "}
              {formatMediumDate(new Date(currentGoal.goal.dueAt))}
            </Text>
          </View>
          <View className="flex-row gap-2">
            <TouchableOpacity
              className="rounded w-10 h-10 items-center justify-center"
              style={{
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.20)",
              }}
              accessibilityRole="button"
              accessibilityLabel="Edit invitation goal"
              onPress={onToggleEditGoal}
            >
              <MoreHorizontal size={17} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity
              className="rounded w-10 h-10 items-center justify-center"
              style={{
                borderWidth: 1,
                borderColor: "rgba(254,202,202,0.70)",
                backgroundColor: "rgba(239,68,68,0.10)",
              }}
              accessibilityRole="button"
              accessibilityLabel="Delete invitation goal"
              disabled={isDeletingGoal}
              onPress={onDeleteGoal}
            >
              <Trash2 size={16} color="#fee2e2" />
            </TouchableOpacity>
          </View>
        </View>

        {editGoalOpen && (
          <View className="rounded bg-white p-4 gap-3">
            <Text
              className="text-sm text-zinc-900"
              weight={FontWeight.Semibold}
            >
              Edit goal
            </Text>
            <Input
              label="Target successful invitations"
              value={editGoalTarget}
              onChangeText={setEditGoalTarget}
              onEndEditing={() => saveEditGoalTarget(editGoalTarget)}
              placeholder="10"
              keyboardType="number-pad"
              editable={!isUpdatingGoal}
            />
            <DatePickerField
              label="Goal start"
              value={editGoalStartDate}
              onChange={changeEditGoalStartDate}
              disabled={isUpdatingGoal}
            />
            <DatePickerField
              label="Goal end"
              value={editGoalDueDate}
              onChange={changeEditGoalDueDate}
              disabled={isUpdatingGoal}
            />
            {isUpdatingGoal && !goalEditMessage && (
              <Text className="text-sm text-zinc-500">Saving...</Text>
            )}
            {goalEditMessage && (
              <Text className="text-sm text-red-500">{goalEditMessage}</Text>
            )}
          </View>
        )}
      </View>

      <View className="gap-1">
        <View
          className="w-full h-4 rounded-full overflow-hidden"
          style={{
            backgroundColor: "rgba(255,255,255,0.20)",
          }}
        >
          <View
            className="h-full bg-white rounded-full"
            style={{
              width: `${currentGoalProgressPercent}%`,
            }}
          />
        </View>
        <Text className="text-sm text-white/70">
          <Text className="text-sm text-white" weight={FontWeight.Semibold}>
            {currentGoal.stats.goalSuccessfulRecruits}
          </Text>{" "}
          / {currentGoal.goal.targetSuccessfulRecruits} successful invitations
        </Text>
        <View
          className="rounded border px-3 py-2 mt-2"
          style={{
            backgroundColor: "rgba(255,255,255,0.10)",
            borderColor: "rgba(255,255,255,0.15)",
          }}
        >
          <Text className="text-xs text-white/70" weight={FontWeight.Semibold}>
            Invites created
          </Text>
          <Text className="text-lg text-white" weight={FontWeight.Semibold}>
            {currentGoal.stats.totalInvitesSent}
          </Text>
        </View>
      </View>
    </View>
  );
}
