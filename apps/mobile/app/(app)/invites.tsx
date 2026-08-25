import { withCount } from "@alliance/common/plural";
import type { OnetimeInviteDto } from "@alliance/shared/client";
import { MEMBER_GOAL } from "@alliance/shared/lib/constants";
import {
  deleteInviteConfirmation,
  inviteBuckets,
  inviteDestination,
  onetimeInviteCreation,
  roleBadges,
} from "@alliance/shared/lib/copy";
import { getOnetimeInviteSignupUrl } from "@alliance/shared/lib/inviteUrls";
import {
  bucketOnetimeInvitesByActionability,
  onetimeInviteNotes,
} from "@alliance/shared/lib/inviteUtils";
import { useAllianceMemberCount } from "@alliance/shared/lib/useAllianceMemberCount";
import { useAmbassadorInviteDashboard } from "@alliance/shared/lib/useAmbassadorInviteDashboard";
import { useMyCommunities } from "@alliance/shared/lib/useMyCommunities";
import { useOnetimeInvitesOverview } from "@alliance/shared/lib/useOnetimeInvitesOverview";
import { getLeaderCommunityIds } from "@alliance/shared/lib/userUtils";
import { formatTime } from "@alliance/shared/lib/utils";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
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
import InviteSettingsModal, {
  type InviteSettingsTarget,
} from "../../components/InviteSettingsModal";
import InviteShareLink from "../../components/InviteShareLink";
import KeyboardAwareScrollView from "../../components/KeyboardAwareScrollView";
import ReferralQrSection from "../../components/ReferralQrSection";
import FormModal from "../../components/forms/FormModal";
import Button, { ButtonColor } from "../../components/system/Button";
import Card from "../../components/system/Card";
import Input from "../../components/system/Input";
import { ScreenWithLoading } from "../../components/system/ScreenWithLoading";
import { SegmentedTabs } from "../../components/system/SegmentedTabs";
import { SimplePageTitle } from "../../components/system/SimplePageTitle";
import Text, { FontWeight } from "../../components/system/Text";
import { useAuth } from "../../lib/AuthContext";
import { getBaseUrl } from "../../lib/config";
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

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const DAY_MS = 24 * 60 * 60 * 1000;

const daysUntil = (date: Date, now = new Date()) =>
  Math.max(0, Math.ceil((date.getTime() - now.getTime()) / DAY_MS));

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

const CALENDAR_WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function DatePickerField({
  label,
  value,
  onChange,
  lightLabel = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  lightLabel?: boolean;
  disabled?: boolean;
}) {
  const selectedDate = new Date(`${value}T12:00:00`);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  );
  const firstWeekday = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
    1,
  ).getDay();
  const daysInMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0,
  ).getDate();

  const openPicker = () => {
    setVisibleMonth(
      new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
    );
    setPickerOpen(true);
  };

  const changeMonth = (offset: number) => {
    setVisibleMonth(
      (month) => new Date(month.getFullYear(), month.getMonth() + offset, 1),
    );
  };

  const selectDate = (date: Date) => {
    onChange(dateToInputValue(date));
    setPickerOpen(false);
  };

  return (
    <View>
      <Text
        className={
          lightLabel
            ? "text-xs text-white/70 mb-1"
            : "text-sm text-zinc-700 mb-2"
        }
        weight={FontWeight.Semibold}
      >
        {label}
      </Text>
      <TouchableOpacity
        className="min-h-11 rounded-lg border border-zinc-200 bg-white px-3 flex-row items-center justify-between"
        accessibilityRole="button"
        accessibilityLabel={`Select ${label.toLowerCase()}`}
        disabled={disabled}
        onPress={openPicker}
      >
        <Text className="text-base text-zinc-700">
          {formatDate(selectedDate)}
        </Text>
        <CalendarDays size={18} color={colors.text.icon} />
      </TouchableOpacity>

      <FormModal visible={pickerOpen} onClose={() => setPickerOpen(false)}>
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-xl" weight={FontWeight.Semibold}>
              Select {label.toLowerCase()}
            </Text>
            <TouchableOpacity
              className="px-2 py-1"
              accessibilityRole="button"
              onPress={() => setPickerOpen(false)}
            >
              <Text style={{ color: colors.green }} weight={FontWeight.Medium}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              className="w-11 h-11 items-center justify-center rounded-full"
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              onPress={() => changeMonth(-1)}
            >
              <ChevronLeft size={22} color={colors.text.icon} />
            </TouchableOpacity>
            <Text className="text-lg" weight={FontWeight.Semibold}>
              {visibleMonth.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric",
              })}
            </Text>
            <TouchableOpacity
              className="w-11 h-11 items-center justify-center rounded-full"
              accessibilityRole="button"
              accessibilityLabel="Next month"
              onPress={() => changeMonth(1)}
            >
              <ChevronRight size={22} color={colors.text.icon} />
            </TouchableOpacity>
          </View>

          <View className="flex-row flex-wrap">
            {CALENDAR_WEEKDAYS.map((weekday, index) => (
              <View
                key={`${weekday}-${index}`}
                className="h-8 items-center justify-center"
                style={{ width: "14.2857%" }}
              >
                <Text
                  className="text-xs text-zinc-500"
                  weight={FontWeight.Semibold}
                >
                  {weekday}
                </Text>
              </View>
            ))}
            {Array.from({ length: firstWeekday }, (_, index) => (
              <View
                key={`empty-${index}`}
                className="h-11"
                style={{ width: "14.2857%" }}
              />
            ))}
            {Array.from({ length: daysInMonth }, (_, index) => {
              const day = index + 1;
              const date = new Date(
                visibleMonth.getFullYear(),
                visibleMonth.getMonth(),
                day,
              );
              const dateValue = dateToInputValue(date);
              const selected = dateValue === value;

              return (
                <View
                  key={dateValue}
                  className="h-11 items-center justify-center"
                  style={{ width: "14.2857%" }}
                >
                  <TouchableOpacity
                    className={
                      selected
                        ? "w-10 h-10 rounded-full items-center justify-center bg-green"
                        : "w-10 h-10 rounded-full items-center justify-center"
                    }
                    accessibilityRole="button"
                    accessibilityLabel={formatDate(date)}
                    accessibilityState={{ selected }}
                    onPress={() => selectDate(date)}
                  >
                    <Text
                      className={selected ? "text-white" : "text-zinc-800"}
                      weight={
                        selected ? FontWeight.Semibold : FontWeight.Regular
                      }
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>

          <Button
            title="Today"
            color={ButtonColor.Outline}
            onPress={() => selectDate(new Date())}
          />
        </View>
      </FormModal>
    </View>
  );
}

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
  const [goalTarget, setGoalTarget] = useState("");
  const [goalStartDate, setGoalStartDate] = useState(todayDateInputValue);
  const [goalDueDate, setGoalDueDate] = useState(
    oneMonthFromTodayDateInputValue,
  );
  const [editGoalStartDate, setEditGoalStartDate] = useState("");
  const [editGoalDueDate, setEditGoalDueDate] = useState("");
  const [editGoalTarget, setEditGoalTarget] = useState("");
  const [goalFormMessage, setGoalFormMessage] = useState<string | null>(null);
  const [goalEditMessage, setGoalEditMessage] = useState<string | null>(null);
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

  const ambassadorGoals = useMemo(
    () => ambassadorDashboard?.goals ?? [],
    [ambassadorDashboard],
  );
  const currentGoal = useMemo(() => {
    const now = new Date();
    const activeGoals = ambassadorGoals.filter((goal) => {
      const startAt = new Date(goal.goal.startAt);
      const dueAt = new Date(goal.goal.dueAt);
      return startAt <= now && dueAt >= now;
    });
    if (activeGoals.length > 0) {
      return [...activeGoals].sort(
        (a, b) =>
          new Date(b.goal.startAt).getTime() -
          new Date(a.goal.startAt).getTime(),
      )[0];
    }

    const futureGoals = ambassadorGoals.filter(
      (goal) => new Date(goal.goal.startAt) > now,
    );
    if (futureGoals.length > 0) {
      return [...futureGoals].sort(
        (a, b) =>
          new Date(a.goal.startAt).getTime() -
          new Date(b.goal.startAt).getTime(),
      )[0];
    }

    return [...ambassadorGoals].sort(
      (a, b) =>
        new Date(b.goal.dueAt).getTime() - new Date(a.goal.dueAt).getTime(),
    )[0];
  }, [ambassadorGoals]);
  const pastGoals = useMemo(() => {
    const now = new Date();
    return ambassadorGoals
      .filter(
        (goal) =>
          goal.goal.id !== currentGoal?.goal.id &&
          new Date(goal.goal.dueAt) < now,
      )
      .sort(
        (a, b) =>
          new Date(b.goal.dueAt).getTime() - new Date(a.goal.dueAt).getTime(),
      );
  }, [ambassadorGoals, currentGoal]);
  const currentGoalIsUp =
    !currentGoal ||
    new Date(currentGoal.goal.dueAt) < new Date() ||
    currentGoal.stats.goalSuccessfulRecruits >=
      currentGoal.goal.targetSuccessfulRecruits;
  const showProminentGoalForm = !currentGoal || currentGoalIsUp;

  useEffect(() => {
    if (!currentGoal) {
      setEditGoalStartDate("");
      setEditGoalDueDate("");
      setEditGoalTarget("");
      return;
    }
    setEditGoalStartDate(dateToInputValue(currentGoal.goal.startAt));
    setEditGoalDueDate(dateToInputValue(currentGoal.goal.dueAt));
    setEditGoalTarget(String(currentGoal.goal.targetSuccessfulRecruits));
    setGoalEditMessage(null);
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

  const leaderCommunities = useMemo(
    () =>
      user
        ? communities.filter((community) =>
            community.leaders.some((leader) => leader.id === user.id),
          )
        : [],
    [communities, user],
  );

  const settingsInvite =
    invites.find((invite) => invite.id === settingsInviteId) ?? null;
  const settingsTarget: InviteSettingsTarget | null = settingsInvite && {
    title: settingsInvite.invitee,
    meta: `Invited ${formatTime(new Date(settingsInvite.createdAt), {
      addSuffix: true,
    })}`,
    url: getOnetimeInviteSignupUrl(getBaseUrl(), settingsInvite.code),
    name: {
      label: "Who this invite is for",
      value: settingsInvite.invitee,
      placeholder: "Their name",
      helper: "Shown to you and to the group lead who takes them on.",
      required: true,
    },
    destination: {
      current: settingsInvite.community?.id ?? null,
      openLabel: onetimeInviteCreation.assignToOpenGroup,
      openDetail: inviteDestination.onetime.openDetail,
      notes: onetimeInviteNotes,
    },
    delete: { enabled: true, disabledReason: "" },
    onSave: ({ name, communityId }) =>
      updateInvite({
        inviteId: settingsInvite.id,
        ...(name !== undefined && { invitee: name }),
        ...(communityId !== undefined && { communityId }),
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
    if (!showProminentGoalForm) {
      Alert.alert(
        "Goal already active",
        "You can set a new goal once your current goal is up.",
      );
      return;
    }

    const target = Number(goalTarget);
    if (!Number.isInteger(target) || target < 1) {
      Alert.alert(
        "Goal needed",
        "Goal must be at least 1 successful invitation.",
      );
      return;
    }
    if (
      Number.isNaN(new Date(`${goalStartDate}T00:00:00`).getTime()) ||
      Number.isNaN(new Date(`${goalDueDate}T23:59:59`).getTime())
    ) {
      Alert.alert("Date needed", "Enter dates as YYYY-MM-DD.");
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
  }, [
    createGoal,
    goalDueDate,
    goalStartDate,
    goalTarget,
    showProminentGoalForm,
  ]);

  const updateCurrentGoal = useCallback(
    (params: {
      targetSuccessfulRecruits?: number;
      startDate?: string;
      dueDate?: string;
    }) => {
      if (!currentGoal) {
        return;
      }

      void updateGoal({
        goalId: currentGoal.goal.id,
        body: {
          ...(params.targetSuccessfulRecruits !== undefined && {
            targetSuccessfulRecruits: params.targetSuccessfulRecruits,
          }),
          ...(params.startDate !== undefined && {
            startAt: dateInputToStartOfDayIso(params.startDate),
          }),
          ...(params.dueDate !== undefined && {
            dueAt: dateInputToEndOfDayIso(params.dueDate),
          }),
        },
      })
        .then(() => {
          setGoalEditMessage(null);
        })
        .catch((err: Error) => {
          setGoalEditMessage(inviteGoalErrorMessage(err));
        });
    },
    [currentGoal, updateGoal],
  );

  const handleEditGoalStartDateChanged = useCallback(
    (value: string) => {
      setEditGoalStartDate(value);
      updateCurrentGoal({ startDate: value });
    },
    [updateCurrentGoal],
  );

  const handleEditGoalDueDateChanged = useCallback(
    (value: string) => {
      setEditGoalDueDate(value);
      updateCurrentGoal({ dueDate: value });
    },
    [updateCurrentGoal],
  );

  const handleEditGoalTargetChanged = useCallback(() => {
    const target = Number(editGoalTarget);
    if (!Number.isInteger(target) || target < 1) {
      setGoalEditMessage("Goal must be at least 1 successful invitation.");
      return;
    }
    updateCurrentGoal({ targetSuccessfulRecruits: target });
  }, [editGoalTarget, updateCurrentGoal]);

  const currentGoalProgressPercent = useMemo(() => {
    if (!currentGoal) {
      return 0;
    }
    return Math.min(
      100,
      (currentGoal.stats.goalSuccessfulRecruits /
        currentGoal.goal.targetSuccessfulRecruits) *
        100,
    );
  }, [currentGoal]);
  const currentGoalInvitesCreated = currentGoal?.stats.totalInvitesSent ?? 0;

  const currentGoalSummary = useMemo(() => {
    if (!currentGoal) {
      return (
        <Text className="text-lg text-white" weight={FontWeight.Semibold}>
          Set a goal to track successful invitations.
        </Text>
      );
    }

    const now = new Date();
    const startAt = new Date(currentGoal.goal.startAt);
    const dueAt = new Date(currentGoal.goal.dueAt);
    const remainingRecruits = Math.max(
      0,
      currentGoal.goal.targetSuccessfulRecruits -
        currentGoal.stats.goalSuccessfulRecruits,
    );

    if (startAt > now) {
      return (
        <Text className="text-lg text-white" weight={FontWeight.Semibold}>
          This goal starts in {withCount(daysUntil(startAt, now), "day")}.
        </Text>
      );
    }

    if (remainingRecruits === 0) {
      return (
        <Text className="text-lg text-white" weight={FontWeight.Semibold}>
          You have completed this invitation goal.
        </Text>
      );
    }

    if (dueAt < now) {
      return (
        <Text className="text-lg text-white" weight={FontWeight.Semibold}>
          This goal ended with {withCount(remainingRecruits, "member")} left to
          successfully invite.
        </Text>
      );
    }

    return (
      <Text className="text-lg text-white" weight={FontWeight.Semibold}>
        You have {withCount(daysUntil(dueAt, now), "day")} to successfully
        invite {withCount(remainingRecruits, "more member")}.
      </Text>
    );
  }, [currentGoal]);

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
        <View className="px-4 pt-4 gap-4">
          {!user.ambassador && (
            <View className="pb-1">
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
          )}
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
                                  {formatDate(currentGoal.goal.startAt)} -{" "}
                                  {formatDate(currentGoal.goal.dueAt)}
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
                                  onEndEditing={handleEditGoalTargetChanged}
                                  placeholder="10"
                                  keyboardType="number-pad"
                                  editable={!isUpdatingGoal}
                                />
                                <DatePickerField
                                  label="Goal start"
                                  value={editGoalStartDate}
                                  onChange={handleEditGoalStartDateChanged}
                                  disabled={isUpdatingGoal}
                                />
                                <DatePickerField
                                  label="Goal end"
                                  value={editGoalDueDate}
                                  onChange={handleEditGoalDueDateChanged}
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
                                    {formatDate(goal.goal.startAt)} -{" "}
                                    {formatDate(goal.goal.dueAt)}
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
