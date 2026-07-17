import type { OnetimeInviteDto } from "@alliance/shared/client";
import { MEMBER_GOAL } from "@alliance/shared/lib/constants";
import { inviteBuckets } from "@alliance/shared/lib/copy";
import { bucketOnetimeInvitesByActionability } from "@alliance/shared/lib/inviteUtils";
import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { useAmbassadorInviteDashboard } from "@alliance/shared/lib/useAmbassadorInviteDashboard";
import { useOnetimeInvitesOverview } from "@alliance/shared/lib/useOnetimeInvitesOverview";
import { getLeaderCommunityIds } from "@alliance/shared/lib/userUtils";
import { Trash2 } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, RefreshControl, TouchableOpacity, View } from "react-native";
import InviteForm from "../../components/InviteForm";
import { InviteSection } from "../../components/InviteSection";
import InviteShareLink from "../../components/InviteShareLink";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import ReferralQrSection from "../../components/ReferralQrSection";
import Button, { ButtonColor } from "../../components/system/Button";
import Card from "../../components/system/Card";
import Input from "../../components/system/Input";
import ProgressBar from "../../components/system/ProgressBar";
import { ScreenWithLoading } from "../../components/system/ScreenWithLoading";
import { SegmentedTabs } from "../../components/system/SegmentedTabs";
import { SimplePageTitle } from "../../components/system/SimplePageTitle";
import Text, { FontWeight } from "../../components/system/Text";
import { useAuth } from "../../lib/AuthContext";
import { colors } from "../../lib/style/colors";
import { useReferralLink } from "../../lib/useReferralLink";

enum InvitesTab {
  ReferralQr = "referral_qr",
  New = "new",
  Reusable = "reusable",
  Past = "past",
}

const INVITES_TAB_LABELS: Record<InvitesTab, string> = {
  [InvitesTab.ReferralQr]: "QR code",
  [InvitesTab.New]: "Individual",
  [InvitesTab.Reusable]: "Multiple",
  [InvitesTab.Past]: "Past",
};

const INVITES_TABS_ORDER: InvitesTab[] = [
  InvitesTab.ReferralQr,
  InvitesTab.New,
  InvitesTab.Reusable,
  InvitesTab.Past,
];

const INVITES_EMPTY_MESSAGE = "Your invites will appear here.";

const formatPercent = (numerator: number, denominator: number) => {
  if (denominator === 0) {
    return "0%";
  }
  return `${Math.round((numerator / denominator) * 100)}%`;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const dateInputToEndOfDayIso = (value: string) =>
  new Date(`${value}T23:59:59`).toISOString();

const dateInputToStartOfDayIso = (value: string) =>
  new Date(`${value}T00:00:00`).toISOString();

const padDatePart = (value: number) => String(value).padStart(2, "0");

const dateToInputValue = (value: string | Date) => {
  const date = new Date(value);
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join("-");
};

const todayDateInputValue = () => dateToInputValue(new Date());

const oneMonthFromTodayDateInputValue = () => {
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  return dateToInputValue(nextMonth);
};

const inviteGoalErrorMessage = (err: Error) => {
  if (err.message.toLowerCase().includes("overlap")) {
    return "Those dates overlap with an existing invite goal.";
  }
  return err.message;
};

const inviteStatsMetrics = (stats: {
  totalInvitesSent: number;
  totalAcceptedInvites: number;
  totalSuccessfulRecruits: number;
}) => [
  {
    label: "Invites",
    value: String(stats.totalInvitesSent),
  },
  {
    label: "Accepted",
    value: String(stats.totalAcceptedInvites),
  },
  {
    label: "Successful",
    value: String(stats.totalSuccessfulRecruits),
  },
  {
    label: "Accepted %",
    value: formatPercent(stats.totalAcceptedInvites, stats.totalInvitesSent),
  },
  {
    label: "Success %",
    value: formatPercent(stats.totalSuccessfulRecruits, stats.totalInvitesSent),
  },
];

export default function InvitesScreen() {
  const { user } = useAuth();
  const {
    invites,
    isLoading: loadingInvites,
    isError,
    refetch,
    upsertInvite,
    approveInvite,
    rejectInvite,
    deleteInvite,
  } = useOnetimeInvitesOverview({ enabled: Boolean(user) });
  const [refreshing, setRefreshing] = useState(false);
  const [sharedInviteId, setSharedInviteId] = useState<number | null>(null);
  const [selectedTab, setSelectedTab] = useState<InvitesTab>(
    InvitesTab.ReferralQr,
  );
  const [goalTarget, setGoalTarget] = useState("");
  const [goalStartDate, setGoalStartDate] = useState(todayDateInputValue);
  const [goalDueDate, setGoalDueDate] = useState(
    oneMonthFromTodayDateInputValue,
  );
  const [selectedGoalIndex, setSelectedGoalIndex] = useState(0);
  const [editGoalStartDate, setEditGoalStartDate] = useState("");
  const [editGoalDueDate, setEditGoalDueDate] = useState("");
  const [goalFormMessage, setGoalFormMessage] = useState<string | null>(null);
  const [goalEditMessage, setGoalEditMessage] = useState<string | null>(null);
  const sharedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousGoalCountRef = useRef(0);
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
    refetch: refetchAmbassadorDashboard,
  } = useAmbassadorInviteDashboard({ enabled: Boolean(user?.ambassador) });

  const selectedGoal = ambassadorDashboard?.goals[selectedGoalIndex];
  const goalCount = ambassadorDashboard?.goals.length ?? 0;

  useEffect(() => {
    const previousGoalCount = previousGoalCountRef.current;
    if (goalCount !== previousGoalCount) {
      previousGoalCountRef.current = goalCount;
      setSelectedGoalIndex(Math.max(0, goalCount - 1));
      return;
    }
    if (selectedGoalIndex >= goalCount) {
      setSelectedGoalIndex(Math.max(0, goalCount - 1));
    }
  }, [goalCount, selectedGoalIndex]);

  useEffect(() => {
    if (!selectedGoal) {
      setEditGoalStartDate("");
      setEditGoalDueDate("");
      return;
    }
    setEditGoalStartDate(dateToInputValue(selectedGoal.goal.startAt));
    setEditGoalDueDate(dateToInputValue(selectedGoal.goal.dueAt));
    setGoalEditMessage(null);
  }, [selectedGoal]);

  const referralLink = useReferralLink(user);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Promise.all([
      refetch(),
      user?.ambassador ? refetchAmbassadorDashboard() : Promise.resolve(),
    ]).finally(() => setRefreshing(false));
  }, [refetch, refetchAmbassadorDashboard, user?.ambassador]);

  const leaderCommunityIds = useMemo(
    () => getLeaderCommunityIds(user ?? undefined),
    [user],
  );

  const { actionable, unverifiableActionable, waitingForResponse, settled } =
    useMemo(() => {
      if (!user) {
        return {
          actionable: [],
          unverifiableActionable: [],
          waitingForResponse: [],
          settled: [],
        };
      }
      return bucketOnetimeInvitesByActionability({
        invites,
        leaderCommunityIds,
        userId: user.id,
      });
    }, [invites, leaderCommunityIds, user]);

  const acceptedInvites = useMemo(
    () => invites.filter((invite) => invite.status === "link_used"),
    [invites],
  );

  const handleShared = useCallback((inviteId: number) => {
    if (sharedTimeoutRef.current) {
      clearTimeout(sharedTimeoutRef.current);
    }
    setSharedInviteId(inviteId);
    sharedTimeoutRef.current = setTimeout(() => {
      setSharedInviteId(null);
      sharedTimeoutRef.current = null;
    }, 2000);
  }, []);

  const handleApproveInvite = useCallback(
    (inviteId: number) => {
      void approveInvite(inviteId).catch(() => {
        Alert.alert("Error", "Failed to approve invite");
      });
    },
    [approveInvite],
  );

  const handleRejectInvite = useCallback(
    (inviteId: number) => {
      void rejectInvite(inviteId).catch(() => {
        Alert.alert("Error", "Failed to reject invite");
      });
    },
    [rejectInvite],
  );

  const handleDeleteInvite = useCallback(
    (inviteId: number, _event: unknown) => {
      void deleteInvite(inviteId).catch(() => {
        Alert.alert("Error", "Failed to delete invite");
      });
    },
    [deleteInvite],
  );

  const handleInviteCreated = useCallback(
    (invite: OnetimeInviteDto) => {
      upsertInvite(invite);
      if (user?.ambassador) {
        void refetchAmbassadorDashboard();
      }
    },
    [refetchAmbassadorDashboard, upsertInvite, user?.ambassador],
  );

  const handleDeleteGoal = useCallback(() => {
    if (!selectedGoal) {
      return;
    }

    const goalId = selectedGoal.goal.id;
    Alert.alert("Delete recruit goal?", "Are you sure you want to do this?", [
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
    ]);
  }, [deleteGoal, selectedGoal]);

  const handleSetGoal = useCallback(() => {
    const target = Number(goalTarget);
    if (!Number.isInteger(target) || target < 1) {
      Alert.alert("Goal needed", "Goal must be at least 1 successful recruit.");
      return;
    }
    if (Number.isNaN(new Date(`${goalDueDate}T23:59:59`).getTime())) {
      Alert.alert("Date needed", "Enter a future due date as YYYY-MM-DD.");
      return;
    }

    void createGoal({
      targetSuccessfulRecruits: target,
      startAt: dateInputToStartOfDayIso(goalStartDate),
      dueAt: dateInputToEndOfDayIso(goalDueDate),
    })
      .then(() => {
        setGoalTarget("");
        setGoalFormMessage(null);
      })
      .catch((err: Error) => {
        setGoalFormMessage(inviteGoalErrorMessage(err));
      });
  }, [createGoal, goalDueDate, goalStartDate, goalTarget]);

  const updateSelectedGoalDates = useCallback(
    (startDate: string, dueDate: string) => {
      if (!selectedGoal) {
        return;
      }

      void updateGoal({
        goalId: selectedGoal.goal.id,
        body: {
          startAt: dateInputToStartOfDayIso(startDate),
          dueAt: dateInputToEndOfDayIso(dueDate),
        },
      })
        .then(() => {
          setGoalEditMessage(null);
        })
        .catch((err: Error) => {
          setGoalEditMessage(inviteGoalErrorMessage(err));
        });
    },
    [selectedGoal, updateGoal],
  );

  const handleEditGoalStartDateChanged = useCallback(() => {
    updateSelectedGoalDates(editGoalStartDate, editGoalDueDate);
  }, [editGoalDueDate, editGoalStartDate, updateSelectedGoalDates]);

  const handleEditGoalDueDateChanged = useCallback(() => {
    updateSelectedGoalDates(editGoalStartDate, editGoalDueDate);
  }, [editGoalDueDate, editGoalStartDate, updateSelectedGoalDates]);

  const selectedGoalProgressPercent = useMemo(() => {
    if (!selectedGoal) {
      return 0;
    }
    return Math.min(
      100,
      (selectedGoal.stats.goalSuccessfulRecruits /
        selectedGoal.goal.targetSuccessfulRecruits) *
        100,
    );
  }, [selectedGoal]);

  const goalPositionLabel = selectedGoal
    ? `${selectedGoalIndex + 1} of ${goalCount}`
    : "No goals yet";

  const canShowOlderGoal = selectedGoalIndex > 0;
  const canShowNewerGoal = selectedGoalIndex < goalCount - 1;

  const isEmptyPast =
    actionable.length === 0 &&
    unverifiableActionable.length === 0 &&
    waitingForResponse.length === 0 &&
    settled.length === 0;

  const { data: allianceMemberCount, isPending: allianceMemberCountPending } =
    useAllianceMemberCount({ enabled: Boolean(user) });

  const allianceProgressPercent = useMemo(() => {
    const n = allianceMemberCount ?? 0;
    return Math.min(100, (n / MEMBER_GOAL) * 100);
  }, [allianceMemberCount]);

  if (!user || loadingInvites) {
    return <ScreenWithLoading title="Invites" loading />;
  }

  const tabContent: Record<InvitesTab, React.ReactNode> = {
    [InvitesTab.ReferralQr]: <ReferralQrSection referralLink={referralLink} />,
    [InvitesTab.New]: (
      <>
        {isError && (
          <Text className="text-sm text-red-500">Failed to load invites</Text>
        )}
        <View className="pt-2">
          <InviteSection
            title={inviteBuckets.unverifiableActionable.title}
            description={inviteBuckets.unverifiableActionable.description}
            invites={unverifiableActionable}
            user={user}
            sharedInviteId={sharedInviteId}
            actions={{
              onDeleteWithConfirm: handleDeleteInvite,
              onShared: handleShared,
            }}
          />
        </View>
      </>
    ),
    [InvitesTab.Reusable]: <InviteShareLink />,
    [InvitesTab.Past]: (
      <>
        {isError && (
          <Text className="text-sm text-red-500">Failed to load invites</Text>
        )}
        {isEmptyPast && (
          <Text className="text-center text-zinc-500 py-8">
            {INVITES_EMPTY_MESSAGE}
          </Text>
        )}
        <InviteSection
          title={inviteBuckets.actionable.title}
          invites={actionable}
          user={user}
          sharedInviteId={sharedInviteId}
          actions={{
            onApprove: handleApproveInvite,
            onReject: handleRejectInvite,
            onShared: handleShared,
          }}
        />
        <InviteSection
          title={inviteBuckets.unverifiableActionable.title}
          description={inviteBuckets.unverifiableActionable.description}
          invites={unverifiableActionable}
          user={user}
          sharedInviteId={sharedInviteId}
          actions={{
            onDeleteWithConfirm: handleDeleteInvite,
            onShared: handleShared,
          }}
        />
        <InviteSection
          title={inviteBuckets.waitingForResponse.title}
          description={inviteBuckets.waitingForResponse.description}
          invites={waitingForResponse}
          user={user}
          sharedInviteId={sharedInviteId}
          actions={{
            onDelete: handleDeleteInvite,
            onShared: handleShared,
          }}
        />
        <InviteSection
          title={inviteBuckets.settled.title}
          description={inviteBuckets.settled.description}
          invites={settled}
          user={user}
          sharedInviteId={sharedInviteId}
          actions={{ onShared: handleShared }}
        />
      </>
    ),
  };

  return (
    <View className="flex-1" style={{ backgroundColor: colors.grey[0] }}>
      <SimplePageTitle title="Invites" />
      <View className="px-4 pb-3">
        <Text className="text-sm text-zinc-500 leading-snug">
          Help the Alliance reach its current growth goal
        </Text>
        <View className="mt-1">
          <View
            className="w-full h-4 rounded-full overflow-hidden"
            style={{ backgroundColor: colors.grey[2] }}
          >
            <View
              className="h-full rounded-full"
              style={{
                width: `${allianceProgressPercent}%`,
                backgroundColor: colors.green,
              }}
            />
          </View>
          <View className="flex-row items-center justify-between mt-1">
            <Text className="text-sm">
              <Text
                className="text-sm"
                weight={FontWeight.Semibold}
                style={{ color: colors.green }}
              >
                {allianceMemberCountPending
                  ? "…"
                  : (allianceMemberCount ?? 0).toLocaleString()}
              </Text>
              <Text className="text-sm text-zinc-500">
                {" "}
                / {MEMBER_GOAL.toLocaleString()} members
              </Text>
            </Text>
            <Text className="text-sm text-zinc-500">
              {acceptedInvites.length} accepted
            </Text>
          </View>
        </View>
      </View>
      <View className="px-4 pt-1 pb-2">
        <SegmentedTabs
          tabs={INVITES_TABS_ORDER}
          selectedTab={selectedTab}
          onSelect={setSelectedTab}
          labels={INVITES_TAB_LABELS}
        />
      </View>
      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="px-4 pt-4 gap-4">
          {selectedTab === InvitesTab.New && (
            <InviteForm onInviteCreated={handleInviteCreated} />
          )}
          {user.ambassador && selectedTab === InvitesTab.New && (
            <Card className="gap-4">
              <View>
                <Text
                  className="text-sm"
                  weight={FontWeight.Semibold}
                  style={{ color: colors.green }}
                >
                  Ambassador
                </Text>
                <Text className="text-2xl" weight={FontWeight.Semibold}>
                  Recruiting dashboard
                </Text>
              </View>

              {ambassadorDashboardError ? (
                <Text className="text-sm text-red-500">
                  Failed to load ambassador invite stats.
                </Text>
              ) : loadingAmbassadorDashboard || !ambassadorDashboard ? (
                <Text className="text-zinc-500">Loading invite stats...</Text>
              ) : (
                <>
                  <View className="gap-3">
                    <View className="gap-3">
                      <View>
                        <Text className="text-lg" weight={FontWeight.Semibold}>
                          Successful recruit goal
                        </Text>
                        <Text className="text-sm text-zinc-500">
                          {selectedGoal
                            ? `${formatDate(selectedGoal.goal.startAt)} - ${formatDate(selectedGoal.goal.dueAt)}`
                            : "Set a goal with a date range."}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-2 self-start">
                        {selectedGoal && (
                          <TouchableOpacity
                            className="border border-red-100 rounded w-10 h-10 items-center justify-center"
                            disabled={isDeletingGoal}
                            onPress={handleDeleteGoal}
                          >
                            <Trash2 size={16} color="#dc2626" />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          className="border border-zinc-200 rounded w-10 h-10 items-center justify-center"
                          disabled={!canShowOlderGoal}
                          onPress={() =>
                            setSelectedGoalIndex((index) =>
                              Math.max(0, index - 1),
                            )
                          }
                        >
                          <Text
                            className={
                              canShowOlderGoal
                                ? "text-zinc-800"
                                : "text-zinc-300"
                            }
                          >
                            {"<"}
                          </Text>
                        </TouchableOpacity>
                        <Text className="text-xs text-zinc-500">
                          {goalPositionLabel}
                        </Text>
                        <TouchableOpacity
                          className="border border-zinc-200 rounded w-10 h-10 items-center justify-center"
                          disabled={!canShowNewerGoal}
                          onPress={() =>
                            setSelectedGoalIndex((index) =>
                              Math.min(goalCount - 1, index + 1),
                            )
                          }
                        >
                          <Text
                            className={
                              canShowNewerGoal
                                ? "text-zinc-800"
                                : "text-zinc-300"
                            }
                          >
                            {">"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <ProgressBar percentage={selectedGoalProgressPercent} />
                    <Text className="text-sm">
                      <Text
                        className="text-sm"
                        weight={FontWeight.Semibold}
                        style={{ color: colors.green }}
                      >
                        {selectedGoal?.stats.goalSuccessfulRecruits ?? 0}
                      </Text>
                      <Text className="text-sm text-zinc-500">
                        {" "}
                        /{" "}
                        {selectedGoal?.goal.targetSuccessfulRecruits ?? 0}{" "}
                        successful recruits
                      </Text>
                    </Text>
                  </View>

                  {selectedGoal && (
                    <View className="flex-row flex-wrap gap-2">
                      {inviteStatsMetrics(selectedGoal.stats).map((metric) => (
                        <View
                          key={metric.label}
                          className="border border-zinc-200 rounded px-3 py-2 basis-[48%]"
                          style={{ backgroundColor: colors.grey[1] }}
                        >
                          <Text className="text-sm text-zinc-500 leading-tight">
                            {metric.label}
                          </Text>
                          <Text className="text-base" weight={FontWeight.Semibold}>
                            {metric.value}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {selectedGoal && (
                    <View className="gap-3">
                      <Input
                        label="Goal start"
                        value={editGoalStartDate}
                        onChangeText={setEditGoalStartDate}
                        onEndEditing={handleEditGoalStartDateChanged}
                        placeholder="YYYY-MM-DD"
                      />
                      <Input
                        label="Goal end"
                        value={editGoalDueDate}
                        onChangeText={setEditGoalDueDate}
                        onEndEditing={handleEditGoalDueDateChanged}
                        placeholder="YYYY-MM-DD"
                      />
                      {isUpdatingGoal && !goalEditMessage && (
                        <Text className="text-sm text-zinc-500">
                          Saving...
                        </Text>
                      )}
                      {goalEditMessage && (
                        <Text className="text-sm text-red-500">
                          {goalEditMessage}
                        </Text>
                      )}
                    </View>
                  )}

                  <View className="gap-3 border-t border-zinc-200 pt-4">
                    <View>
                      <Text className="text-lg" weight={FontWeight.Semibold}>
                        Set a new goal
                      </Text>
                      <Text className="text-sm text-zinc-500">
                        New goals can start in the past, but they cannot
                        overlap another invite goal.
                      </Text>
                    </View>
                    <Input
                      label="Target successful recruits"
                      value={goalTarget}
                      onChangeText={setGoalTarget}
                      placeholder="10"
                      keyboardType="number-pad"
                    />
                    <Input
                      label="Start date"
                      value={goalStartDate}
                      onChangeText={setGoalStartDate}
                      placeholder="YYYY-MM-DD"
                    />
                    <Input
                      label="End date"
                      value={goalDueDate}
                      onChangeText={setGoalDueDate}
                      placeholder="YYYY-MM-DD"
                      helperText="Defaults to one month from today. Past ranges are allowed."
                    />
                    <Button
                      title="Set goal"
                      onPress={handleSetGoal}
                      color={ButtonColor.Black}
                      loading={isCreatingGoal}
                    />
                    {goalFormMessage && (
                      <Text className="text-sm text-red-500">
                        {goalFormMessage}
                      </Text>
                    )}
                  </View>

                  <View className="border border-zinc-200 rounded p-3 gap-2">
                    <Text className="text-sm text-zinc-600" weight={FontWeight.Medium}>
                      Total invite stats
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                      {inviteStatsMetrics(ambassadorDashboard.stats).map(
                        (metric) => (
                          <View key={metric.label} className="basis-[48%]">
                            <Text className="text-sm text-zinc-500 leading-tight">
                              {metric.label}
                            </Text>
                            <Text
                              className="text-base"
                              weight={FontWeight.Semibold}
                            >
                              {metric.value}
                            </Text>
                          </View>
                        ),
                      )}
                    </View>
                  </View>

                  <Text className="text-sm text-zinc-500 leading-snug">
                    Successful recruits are counted when someone you invited
                    signs their membership contract.
                  </Text>
                </>
              )}
            </Card>
          )}
          {tabContent[selectedTab]}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}
