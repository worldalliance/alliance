import { MEMBER_GOAL } from "@alliance/shared/lib/constants";
import { roleBadges } from "@alliance/shared/lib/copy";
import { formatMediumDate } from "@alliance/shared/lib/dateFormatters";
import {
  inviteGoalProgressPercent,
  selectInviteGoals,
} from "@alliance/shared/lib/inviteGoals";
import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { useAmbassadorInviteDashboard } from "@alliance/shared/lib/useAmbassadorInviteDashboard";
import {
  newInviteGoalErrorCopy,
  useInviteGoalForms,
} from "@alliance/shared/lib/useInviteGoalForms";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, TouchableOpacity, View } from "react-native";
import { colors } from "../lib/style/colors";
import { CurrentInviteGoal } from "./CurrentInviteGoal";
import DatePickerField from "./forms/DatePickerField";
import Button, { ButtonColor } from "./system/Button";
import Card from "./system/Card";
import Input from "./system/Input";
import Text, { FontWeight } from "./system/Text";

export default function AmbassadorInviteGoalCard() {
  const [ambassadorDashboardExpanded, setAmbassadorDashboardExpanded] =
    useState(false);
  const [editGoalOpen, setEditGoalOpen] = useState(false);
  const [pastGoalsOpen, setPastGoalsOpen] = useState(false);
  const {
    data: ambassadorDashboard,
    isLoading: loadingAmbassadorDashboard,
    isError: ambassadorDashboardError,
    createGoal,
    isCreatingGoal,
    updateGoal,
    isUpdatingGoal,
    deleteGoal,
    isDeletingGoal,
  } = useAmbassadorInviteDashboard();

  const { currentGoal, pastGoals } = useMemo(
    () => selectInviteGoals(ambassadorDashboard?.goals ?? []),
    [ambassadorDashboard],
  );
  const goalForms = useInviteGoalForms({ currentGoal, createGoal, updateGoal });
  const {
    goalTarget,
    setGoalTarget,
    goalStartDate,
    setGoalStartDate,
    goalDueDate,
    setGoalDueDate,
    goalFormMessage,
    submitNewGoal,
    showProminentGoalForm,
  } = goalForms;

  useEffect(() => {
    setEditGoalOpen(false);
  }, [currentGoal]);

  const handleDeleteGoal = useCallback(() => {
    if (!currentGoal) {
      return;
    }

    const goalId = currentGoal.goal.id;
    Alert.alert(
      "Delete invitation goal?",
      "Are you sure you want to do this?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete goal",
          style: "destructive",
          onPress: () => {
            void deleteGoal(goalId).catch(() => {
              Alert.alert("Error", "Failed to delete goal");
            });
          },
        },
      ],
    );
  }, [currentGoal, deleteGoal]);

  const handleSetGoal = useCallback(() => {
    const result = submitNewGoal();
    if (!result.ok) {
      const { title, message } = newInviteGoalErrorCopy[result.error];
      Alert.alert(title, message);
    }
  }, [submitNewGoal]);

  const currentGoalProgressPercent = currentGoal
    ? inviteGoalProgressPercent(currentGoal)
    : 0;

  const { data: allianceMemberCount, isPending: allianceMemberCountPending } =
    useAllianceMemberCount();

  return (
    <Card className="gap-5 p-5" style={{ backgroundColor: "#306028" }}>
      <TouchableOpacity
        className="gap-3"
        accessibilityRole="button"
        accessibilityState={{ expanded: ambassadorDashboardExpanded }}
        onPress={() => setAmbassadorDashboardExpanded((expanded) => !expanded)}
      >
        <View className="flex-row items-center gap-3">
          <View className="flex-1 gap-1">
            <Text
              className="text-xs text-white self-start rounded-sm px-2 py-0.5"
              weight={FontWeight.Semibold}
              style={{ backgroundColor: colors.ambassador }}
            >
              {roleBadges.ambassador.label}
            </Text>
            <Text
              className="text-xl text-white leading-tight"
              weight={FontWeight.Semibold}
            >
              Current invitation goal
            </Text>
          </View>
          {ambassadorDashboardExpanded ? (
            <ChevronUp size={22} color="#ffffff" />
          ) : (
            <ChevronDown size={22} color="#ffffff" />
          )}
        </View>

        {!ambassadorDashboardExpanded &&
          (loadingAmbassadorDashboard ? (
            <Text className="text-sm text-white/70">
              Loading invitation goal...
            </Text>
          ) : currentGoal ? (
            <View className="gap-1">
              <View
                className="w-full h-4 rounded-full overflow-hidden"
                style={{
                  backgroundColor: "rgba(255,255,255,0.20)",
                }}
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel="Successful invitations toward invitation goal"
                accessibilityValue={{
                  min: 0,
                  max: currentGoal.goal.targetSuccessfulRecruits,
                  now: currentGoal.stats.goalSuccessfulRecruits,
                }}
              >
                <View
                  className="h-full bg-white rounded-full"
                  style={{ width: `${currentGoalProgressPercent}%` }}
                />
              </View>
              <Text className="text-sm text-white/70">
                <Text
                  className="text-sm text-white"
                  weight={FontWeight.Semibold}
                >
                  {currentGoal.stats.goalSuccessfulRecruits}
                </Text>{" "}
                / {currentGoal.goal.targetSuccessfulRecruits} successful
                invitations
              </Text>
            </View>
          ) : (
            <Text className="text-sm text-white/70">
              Set a goal to track successful invitations.
            </Text>
          ))}
      </TouchableOpacity>

      {ambassadorDashboardExpanded && (
        <View className="gap-5">
          <Text className="text-sm text-white/70">
            Alliance growth goal:{" "}
            <Text className="text-sm text-white" weight={FontWeight.Semibold}>
              {allianceMemberCountPending
                ? "..."
                : (allianceMemberCount ?? 0).toLocaleString()}
            </Text>{" "}
            / {MEMBER_GOAL.toLocaleString()} members.
          </Text>

          {ambassadorDashboardError ? (
            <Text className="text-sm text-red-100">
              Failed to load invitation goal stats.
            </Text>
          ) : loadingAmbassadorDashboard || !ambassadorDashboard ? (
            <Text className="text-white/70">
              Loading invitation goal stats...
            </Text>
          ) : (
            <View className="gap-5">
              {currentGoal && (
                <CurrentInviteGoal
                  currentGoal={currentGoal}
                  goalForms={goalForms}
                  editGoalOpen={editGoalOpen}
                  onToggleEditGoal={() => setEditGoalOpen((open) => !open)}
                  onDeleteGoal={handleDeleteGoal}
                  isUpdatingGoal={isUpdatingGoal}
                  isDeletingGoal={isDeletingGoal}
                />
              )}

              {pastGoals.length > 0 && (
                <View
                  className="rounded border px-4 py-3"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.10)",
                    borderColor: "rgba(255,255,255,0.15)",
                  }}
                >
                  <TouchableOpacity
                    className="flex-row items-center justify-between min-h-8"
                    accessibilityRole="button"
                    accessibilityState={{ expanded: pastGoalsOpen }}
                    onPress={() => setPastGoalsOpen((open) => !open)}
                  >
                    <Text
                      className="text-sm text-white/80"
                      weight={FontWeight.Medium}
                    >
                      View past goals
                    </Text>
                    {pastGoalsOpen ? (
                      <ChevronUp size={18} color="rgba(255,255,255,0.8)" />
                    ) : (
                      <ChevronDown size={18} color="rgba(255,255,255,0.8)" />
                    )}
                  </TouchableOpacity>
                  {pastGoalsOpen && (
                    <View className="mt-2">
                      {pastGoals.map((goal, index) => (
                        <View
                          key={goal.goal.id}
                          className={
                            index === 0
                              ? "py-3 gap-1"
                              : "py-3 gap-1 border-t border-white/15"
                          }
                        >
                          <Text className="text-sm text-white/70">
                            {formatMediumDate(new Date(goal.goal.startAt))} -{" "}
                            {formatMediumDate(new Date(goal.goal.dueAt))}
                          </Text>
                          <Text className="text-sm text-white/70">
                            <Text
                              className="text-sm text-white"
                              weight={FontWeight.Semibold}
                            >
                              {goal.stats.goalSuccessfulRecruits}
                            </Text>{" "}
                            / {goal.goal.targetSuccessfulRecruits} successful
                            invitations
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {showProminentGoalForm && (
                <View
                  className="rounded border p-4 gap-3"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.10)",
                    borderColor: "rgba(255,255,255,0.15)",
                  }}
                >
                  <View>
                    <Text
                      className="text-lg text-white"
                      weight={FontWeight.Semibold}
                    >
                      {currentGoal ? "Set a new goal" : "Set a goal"}
                    </Text>
                    <Text className="text-sm text-white/70">
                      New goals can start in the past, but they cannot overlap
                      another invite goal.
                    </Text>
                  </View>
                  <View>
                    <Text
                      className="text-xs text-white/70 mb-1"
                      weight={FontWeight.Semibold}
                    >
                      Target successful invitations
                    </Text>
                    <Input
                      value={goalTarget}
                      onChangeText={setGoalTarget}
                      placeholder="10"
                      keyboardType="number-pad"
                    />
                  </View>
                  <DatePickerField
                    label="Start date"
                    value={goalStartDate}
                    onChange={setGoalStartDate}
                    lightLabel
                  />
                  <DatePickerField
                    label="End date"
                    value={goalDueDate}
                    onChange={setGoalDueDate}
                    lightLabel
                  />
                  <Button
                    onPress={handleSetGoal}
                    color={ButtonColor.White}
                    loading={isCreatingGoal}
                    className="border-white"
                  >
                    <Text
                      weight={FontWeight.Semibold}
                      style={{ color: "#306028" }}
                    >
                      Set goal
                    </Text>
                  </Button>
                  {goalFormMessage && (
                    <Text className="text-sm text-red-100">
                      {goalFormMessage}
                    </Text>
                  )}
                </View>
              )}

              <Text className="text-sm text-white/70 leading-snug">
                Successful invitations are people you invited who signed their
                membership contract.
              </Text>
            </View>
          )}
        </View>
      )}
    </Card>
  );
}
