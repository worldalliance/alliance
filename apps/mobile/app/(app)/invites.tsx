/* eslint-disable alliance/max-lines -- TODO: legacy file over the 500-line limit; split it up */
import { isLedBy } from "@alliance/shared/lib/communityUtils";
import { MEMBER_GOAL } from "@alliance/shared/lib/constants";
import {
  deleteInviteConfirmation,
  inviteBuckets,
  roleBadges,
} from "@alliance/shared/lib/copy";
import { formatMediumDate } from "@alliance/shared/lib/dateFormatters";
import {
  inviteGoalProgressPercent,
  inviteGoalStatus,
  inviteGoalSummary,
  selectInviteGoals,
} from "@alliance/shared/lib/inviteGoals";
import {
  onetimeInviteSettings,
  type InviteSettingsTarget,
} from "@alliance/shared/lib/inviteSettings";
import { bucketOnetimeInvitesByActionability } from "@alliance/shared/lib/inviteUtils";
import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { useAmbassadorInviteDashboard } from "@alliance/shared/lib/useAmbassadorInviteDashboard";
import {
  newInviteGoalErrorCopy,
  useInviteGoalForms,
} from "@alliance/shared/lib/useInviteGoalForms";
import { useMyCommunities } from "@alliance/shared/lib/useMyCommunities";
import { useOnetimeInvitesOverview } from "@alliance/shared/lib/useOnetimeInvitesOverview";
import { getLeaderCommunityIds } from "@alliance/shared/lib/userUtils";
import { milliseconds } from "date-fns";
import {
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Trash2,
} from "lucide-react-native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, RefreshControl, TouchableOpacity, View } from "react-native";
import InviteForm from "../../components/InviteForm";
import { InviteSection } from "../../components/InviteSection";
import InviteSettingsModal from "../../components/InviteSettingsModal";
import InviteShareLink from "../../components/InviteShareLink";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import ReferralQrSection from "../../components/ReferralQrSection";
import DatePickerField from "../../components/forms/DatePickerField";
import Button, { ButtonColor } from "../../components/system/Button";
import Card from "../../components/system/Card";
import Input from "../../components/system/Input";
import { ScreenWithLoading } from "../../components/system/ScreenWithLoading";
import { SegmentedTabs } from "../../components/system/SegmentedTabs";
import { SimplePageTitle } from "../../components/system/SimplePageTitle";
import Text, { FontWeight } from "../../components/system/Text";
import { useAuth } from "../../lib/AuthContext";
import { getSiteUrl } from "../../lib/config";
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

export default function InvitesScreen() {
  const { user } = useAuth();
  const {
    invites,
    isLoading: loadingInvites,
    isError,
    refetch,
    approveInvite,
    rejectInvite,
    updateInvite,
    deleteInvite,
  } = useOnetimeInvitesOverview({ enabled: Boolean(user) });
  const { communities } = useMyCommunities({});
  const [refreshing, setRefreshing] = useState(false);
  const [sharedInviteId, setSharedInviteId] = useState<number | null>(null);
  const [settingsInviteId, setSettingsInviteId] = useState<number | null>(null);
  const [selectedTab, setSelectedTab] = useState<InvitesTab>(
    InvitesTab.ReferralQr,
  );
  const [ambassadorDashboardExpanded, setAmbassadorDashboardExpanded] =
    useState(false);
  const [editGoalOpen, setEditGoalOpen] = useState(false);
  const [pastGoalsOpen, setPastGoalsOpen] = useState(false);
  const sharedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const { currentGoal, pastGoals } = useMemo(
    () => selectInviteGoals(ambassadorDashboard?.goals ?? []),
    [ambassadorDashboard],
  );
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
    editGoalStartDate,
    changeEditGoalStartDate,
    editGoalDueDate,
    changeEditGoalDueDate,
    editGoalTarget,
    setEditGoalTarget,
    saveEditGoalTarget,
    goalEditMessage,
  } = useInviteGoalForms({ currentGoal, createGoal, updateGoal });

  useEffect(() => {
    setEditGoalOpen(false);
  }, [currentGoal]);

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
    useMemo(
      () =>
        bucketOnetimeInvitesByActionability({
          invites,
          leaderCommunityIds,
          userId: user?.id,
        }),
      [invites, leaderCommunityIds, user?.id],
    );

  const handleShared = useCallback((inviteId: number) => {
    if (sharedTimeoutRef.current) {
      clearTimeout(sharedTimeoutRef.current);
    }
    setSharedInviteId(inviteId);
    sharedTimeoutRef.current = setTimeout(
      () => {
        setSharedInviteId(null);
        sharedTimeoutRef.current = null;
      },
      milliseconds({ seconds: 2 }),
    );
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

  const leaderCommunities = useMemo(
    () =>
      user
        ? communities.filter((community) => isLedBy(community, user.id))
        : [],
    [communities, user],
  );

  const settingsInvite =
    invites.find((invite) => invite.id === settingsInviteId) ?? null;
  const settingsTarget: InviteSettingsTarget | null = settingsInvite && {
    ...onetimeInviteSettings({
      invite: settingsInvite,
      baseUrl: getSiteUrl(),
      updateInvite,
    }),
    onDelete: async () => {
      setSettingsInviteId(null);
      Alert.alert(deleteInviteConfirmation.message, undefined, [
        { text: deleteInviteConfirmation.cancelLabel, style: "cancel" },
        {
          text: deleteInviteConfirmation.confirmLabel,
          style: "destructive",
          onPress: () => handleDeleteInvite(settingsInvite.id, null),
        },
      ]);
    },
  };

  const handleInviteCreated = useCallback(() => {
    if (user?.ambassador) {
      void refetchAmbassadorDashboard();
    }
  }, [refetchAmbassadorDashboard, user?.ambassador]);

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
  const currentGoalInvitesCreated = currentGoal?.stats.totalInvitesSent ?? 0;

  const currentGoalSummary = useMemo(
    () =>
      currentGoal && (
        <Text className="text-lg text-white" weight={FontWeight.Semibold}>
          {inviteGoalSummary(inviteGoalStatus(currentGoal))
            .map((part) => (typeof part === "string" ? part : part.emphasis))
            .join("")}
        </Text>
      ),
    [currentGoal],
  );

  const isEmptyPast =
    actionable.length === 0 &&
    unverifiableActionable.length === 0 &&
    waitingForResponse.length === 0 &&
    settled.length === 0;

  const { data: allianceMemberCount, isPending: allianceMemberCountPending } =
    useAllianceMemberCount({ enabled: Boolean(user) });

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
              onOpenSettings: setSettingsInviteId,
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
            onOpenSettings: setSettingsInviteId,
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
      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingBottom: 24, flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View className="px-4 gap-4">
          {user.ambassador && (
            <Card className="gap-5 p-5" style={{ backgroundColor: "#306028" }}>
              <TouchableOpacity
                className="gap-3"
                accessibilityRole="button"
                accessibilityState={{ expanded: ambassadorDashboardExpanded }}
                onPress={() =>
                  setAmbassadorDashboardExpanded((expanded) => !expanded)
                }
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
                    <Text
                      className="text-sm text-white"
                      weight={FontWeight.Semibold}
                    >
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
                                {currentGoalSummary}
                                <Text className="text-sm text-white/70">
                                  {formatMediumDate(
                                    new Date(currentGoal.goal.startAt),
                                  )}{" "}
                                  -{" "}
                                  {formatMediumDate(
                                    new Date(currentGoal.goal.dueAt),
                                  )}
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
                                  onPress={() =>
                                    setEditGoalOpen((open) => !open)
                                  }
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
                                  onPress={handleDeleteGoal}
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
                                  onEndEditing={() =>
                                    saveEditGoalTarget(editGoalTarget)
                                  }
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
                              <Text
                                className="text-sm text-white"
                                weight={FontWeight.Semibold}
                              >
                                {currentGoal.stats.goalSuccessfulRecruits}
                              </Text>{" "}
                              / {currentGoal.goal.targetSuccessfulRecruits}{" "}
                              successful invitations
                            </Text>
                            <View
                              className="rounded border px-3 py-2 mt-2"
                              style={{
                                backgroundColor: "rgba(255,255,255,0.10)",
                                borderColor: "rgba(255,255,255,0.15)",
                              }}
                            >
                              <Text
                                className="text-xs text-white/70"
                                weight={FontWeight.Semibold}
                              >
                                Invites created
                              </Text>
                              <Text
                                className="text-lg text-white"
                                weight={FontWeight.Semibold}
                              >
                                {currentGoalInvitesCreated}
                              </Text>
                            </View>
                          </View>
                        </View>
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
                              <ChevronUp
                                size={18}
                                color="rgba(255,255,255,0.8)"
                              />
                            ) : (
                              <ChevronDown
                                size={18}
                                color="rgba(255,255,255,0.8)"
                              />
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
                                    {formatMediumDate(
                                      new Date(goal.goal.startAt),
                                    )}{" "}
                                    -{" "}
                                    {formatMediumDate(
                                      new Date(goal.goal.dueAt),
                                    )}
                                  </Text>
                                  <Text className="text-sm text-white/70">
                                    <Text
                                      className="text-sm text-white"
                                      weight={FontWeight.Semibold}
                                    >
                                      {goal.stats.goalSuccessfulRecruits}
                                    </Text>{" "}
                                    / {goal.goal.targetSuccessfulRecruits}{" "}
                                    successful invitations
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
                              New goals can start in the past, but they cannot
                              overlap another invite goal.
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
                        Successful invitations are people you invited who signed
                        their membership contract.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </Card>
          )}
          <SegmentedTabs
            tabs={INVITES_TABS_ORDER}
            selectedTab={selectedTab}
            onSelect={setSelectedTab}
            labels={INVITES_TAB_LABELS}
          />
          {selectedTab === InvitesTab.New && (
            <InviteForm onInviteCreated={handleInviteCreated} />
          )}
          {tabContent[selectedTab]}
        </View>
      </KeyboardAwareScrollView>

      <InviteSettingsModal
        target={settingsTarget}
        leaderCommunities={leaderCommunities}
        onClose={() => setSettingsInviteId(null)}
      />
    </View>
  );
}
