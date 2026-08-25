import { withCount } from "@alliance/common/plural";
import { OnetimeInviteDto } from "@alliance/shared/client";
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
import { useReusableInvites } from "@alliance/shared/lib/useReusableInvites";
import { getLeaderCommunityIds } from "@alliance/shared/lib/userUtils";
import { formatTime } from "@alliance/shared/lib/utils";
import { CardStyle } from "@alliance/shared/styles/card";
import { cn } from "@alliance/shared/styles/util";
import { getBaseUrl } from "@alliance/sharedweb/lib/config";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { MoreHorizontal, Trash2, UserCheck } from "lucide-react";
import type { FormEvent, MouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ExpandableList from "../../components/ExpandableList";
import InviteForm from "../../components/InviteForm";
import InviteSettingsModal, {
  type InviteSettingsTarget,
} from "../../components/InviteSettingsModal";
import InviteShareLink from "../../components/InviteShareLink";
import OnetimeInviteListItem from "../../components/OnetimeInviteListItem";
import { useAuth } from "../../lib/AuthContext";

enum InviteListTab {
  Individual = "individual",
  Group = "group",
}

const INVITE_LIST_TABS = [
  InviteListTab.Individual,
  InviteListTab.Group,
] as const;

const INVITE_LIST_TAB_LABELS: Record<InviteListTab, string> = {
  [InviteListTab.Individual]: "Individual invites",
  [InviteListTab.Group]: "Group invites",
};

const formatDate = (value: string) =>
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

const InvitesPage = () => {
  const { user } = useAuth();
  const { error: errorToast, confirm } = useToast();
  const {
    invites,
    isLoading: loadingInvites,
    isError,
    upsertInvite,
    approveInvite,
    rejectInvite,
    updateInvite,
    deleteInvite,
  } = useOnetimeInvitesOverview({ enabled: Boolean(user) });
  const { communities } = useMyCommunities({});
  const { links: reusableInviteLinks } = useReusableInvites({
    enabled: Boolean(user),
  });
  const [settingsInviteId, setSettingsInviteId] = useState<number | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<number | null>(null);
  const [inviteListTab, setInviteListTab] = useState(InviteListTab.Individual);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const currentGoalSummary = useMemo(() => {
    if (!currentGoal) {
      return "Set a goal to track successful invitations.";
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
      const daysToStart = daysUntil(startAt, now);
      return (
        <>
          This goal starts in{" "}
          <span className="font-semibold text-white">
            {withCount(daysToStart, "day")}
          </span>
          .
        </>
      );
    }

    if (remainingRecruits === 0) {
      return "You have completed this invitation goal.";
    }

    if (dueAt < now) {
      return (
        <>
          This goal ended with{" "}
          <span className="font-semibold text-white">
            {withCount(remainingRecruits, "member")}
          </span>{" "}
          left to successfully invite.
        </>
      );
    }

    return (
      <>
        You have{" "}
        <span className="font-semibold text-white">
          {withCount(daysUntil(dueAt, now), "day")}
        </span>{" "}
        to successfully invite{" "}
        <span className="font-semibold text-white">
          {withCount(remainingRecruits, "more member")}
        </span>
        .
      </>
    );
  }, [currentGoal]);

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
  }, [currentGoal]);

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

  const acceptedInvites = useMemo(() => {
    return invites.filter((invite) => invite.status === "link_used");
  }, [invites]);
  const hasSingleUseInvites =
    actionable.length > 0 ||
    unverifiableActionable.length > 0 ||
    waitingForResponse.length > 0 ||
    settled.length > 0;
  const hasGroupInvites = reusableInviteLinks.length > 0;
  const showInviteTypeTabs = hasSingleUseInvites && hasGroupInvites;
  const showingIndividualInvites = showInviteTypeTabs
    ? inviteListTab === InviteListTab.Individual
    : hasSingleUseInvites || (isError && !hasGroupInvites);
  const showingGroupInvites = showInviteTypeTabs
    ? inviteListTab === InviteListTab.Group
    : hasGroupInvites;

  const copyToClipboard = useCallback((text: string) => {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/signup?ref=${text}`;
    navigator.clipboard.writeText(url);
  }, []);

  const handleCopied = useCallback((inviteId: number) => {
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
    }
    setCopiedInviteId(inviteId);
    copiedTimeoutRef.current = setTimeout(() => {
      setCopiedInviteId(null);
      copiedTimeoutRef.current = null;
    }, 2000);
  }, []);

  const handleApproveInvite = useCallback(
    (inviteId: number) => {
      void approveInvite(inviteId).catch((err: Error) => {
        errorToast(`Failed to approve invite: ${err.message}`);
      });
    },
    [approveInvite, errorToast],
  );

  const handleRejectInvite = useCallback(
    (inviteId: number) => {
      void rejectInvite(inviteId).catch((err: Error) => {
        errorToast(`Failed to reject invite: ${err.message}`);
      });
    },
    [rejectInvite, errorToast],
  );

  const handleDeleteInvite = useCallback(
    (inviteId: number, event: MouseEvent<HTMLElement>) => {
      void (async () => {
        const ok = await confirm({
          message: deleteInviteConfirmation.message,
          confirmLabel: deleteInviteConfirmation.confirmLabel,
          cancelLabel: deleteInviteConfirmation.cancelLabel,
          anchorEl: event.currentTarget,
          placement: "topleft",
        });
        if (!ok) {
          return;
        }

        await deleteInvite(inviteId).catch(() => {});
      })();
    },
    [confirm, deleteInvite],
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
    meta: `Invited ${formatTime(new Date(settingsInvite.createdAt), { addSuffix: true })}`,
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
    delete: {
      enabled: true,
      disabledReason: "",
      confirmMessage: deleteInviteConfirmation.message,
    },
    onSave: ({ name, communityId }) =>
      updateInvite({
        inviteId: settingsInvite.id,
        ...(name !== undefined && { invitee: name }),
        ...(communityId !== undefined && { communityId }),
      }),
    onDelete: () => deleteInvite(settingsInvite.id),
  };

  const handleDeleteRequest = useCallback(
    (inviteId: number) => {
      void deleteInvite(inviteId).catch(() => {});
    },
    [deleteInvite],
  );

  const handleInviteCreated = useCallback(
    (invite: OnetimeInviteDto) => {
      upsertInvite(invite);
      setInviteListTab(InviteListTab.Individual);
      if (user?.ambassador) {
        void refetchAmbassadorDashboard();
      }
    },
    [refetchAmbassadorDashboard, upsertInvite, user?.ambassador],
  );

  const handleReusableInviteCreated = useCallback(() => {
    setInviteListTab(InviteListTab.Group);
  }, []);

  const handleDeleteGoal = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (!currentGoal) {
        return;
      }

      const goalId = currentGoal.goal.id;
      void (async () => {
        const ok = await confirm({
          title: "Delete invitation goal?",
          message: "Are you sure you want to do this?",
          confirmLabel: "Delete goal",
          cancelLabel: "Cancel",
          anchorEl: event.currentTarget,
          placement: "topleft",
        });
        if (!ok) {
          return;
        }

        await deleteGoal(goalId).catch((err: Error) => {
          errorToast(`Failed to delete goal: ${err.message}`);
        });
      })();
    },
    [confirm, currentGoal, deleteGoal, errorToast],
  );

  const handleSetGoal = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!showProminentGoalForm) {
        errorToast("You can set a new goal once your current goal is up.");
        return;
      }

      const target = Number(goalTarget);
      if (!Number.isInteger(target) || target < 1) {
        errorToast("Goal must be at least 1 successful invitation.");
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
    },
    [
      createGoal,
      errorToast,
      goalDueDate,
      goalStartDate,
      goalTarget,
      showProminentGoalForm,
    ],
  );

  const updateSelectedGoal = useCallback(
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

  const handleEditGoalStartDateChange = useCallback(
    (value: string) => {
      setEditGoalStartDate(value);
      updateSelectedGoal({ startDate: value });
    },
    [updateSelectedGoal],
  );

  const handleEditGoalDueDateChange = useCallback(
    (value: string) => {
      setEditGoalDueDate(value);
      updateSelectedGoal({ dueDate: value });
    },
    [updateSelectedGoal],
  );

  const handleEditGoalTargetChange = useCallback(
    (value: string) => {
      setEditGoalTarget(value);
      const target = Number(value);
      if (!Number.isInteger(target) || target < 1) {
        setGoalEditMessage("Goal must be at least 1 successful invitation.");
        return;
      }
      updateSelectedGoal({ targetSuccessfulRecruits: target });
    },
    [updateSelectedGoal],
  );

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

  const { data: allianceMemberCount, isPending: allianceMemberCountPending } =
    useAllianceMemberCount({ enabled: Boolean(user) });

  if (!user || loadingInvites) {
    return (
      <div className="flex min-h-[calc(100dvh-var(--navbar-top-bar-height))] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <CenterLayout>
      <div
        className={
          user.ambassador ? "flex flex-col gap-y-8" : "flex flex-col gap-y-2"
        }
      >
        {user.ambassador ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <h1 className="text-title">Invites</h1>
            <div className="flex flex-row items-center gap-x-2 bg-white rounded px-4 py-3 shrink-0 sm:min-w-52">
              <UserCheck className="w-10 h-10 bg-green/10 rounded p-2 text-green" />
              <div>
                <p className="font-semibold text-black text-lg sm:text-xl">
                  {acceptedInvites.length}
                </p>
                <p className="leading-none text-zinc-500 text-sm sm:text-base">
                  Your accepted invites
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-y-4">
            <div className="flex flex-col gap-y-4">
              <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-x-6">
                <h1 className="text-title">Invites</h1>
                <div className="flex flex-row items-center gap-x-2 bg-white rounded p-4 shrink-0">
                  <UserCheck className="w-10 h-10 bg-green/10 rounded p-2 text-green" />
                  <div>
                    <p className="font-semibold text-black text-lg sm:text-xl">
                      {acceptedInvites.length}
                    </p>
                    <p className="leading-none text-zinc-500 text-sm sm:text-base">
                      Accepted invites
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {user.ambassador && (
          <Card
            style={CardStyle.White}
            className="p-6 gap-y-5 bg-green-bg-card border-none text-white shadow-sm"
          >
            <div className="flex flex-col gap-y-1">
              <div className="text-xs bg-ambassador text-white px-2 py-0.5 rounded-sm self-start cursor-default">
                {roleBadges.ambassador.label}
              </div>
              <h2 className="text-2xl font-semibold leading-tight">
                Current invitation goal
              </h2>
              <p className="text-sm text-white/70">
                Alliance growth goal:{" "}
                <span className="font-semibold text-white">
                  {allianceMemberCountPending
                    ? "..."
                    : (allianceMemberCount ?? 0).toLocaleString()}
                </span>{" "}
                / {MEMBER_GOAL.toLocaleString()} members.
              </p>
            </div>

            {ambassadorDashboardError ? (
              <p className="text-sm text-red-100">
                Failed to load invitation goal stats.
              </p>
            ) : loadingAmbassadorDashboard || !ambassadorDashboard ? (
              <Spinner />
            ) : (
              <div className="flex flex-col gap-y-5">
                {currentGoal && (
                  <div className="rounded border border-white/15 bg-white/10 p-4 sm:p-5 flex flex-col gap-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                      <div>
                        <p className="font-semibold text-lg leading-snug">
                          {currentGoalSummary}
                        </p>
                        <p className="text-sm text-white/70">
                          {formatDate(currentGoal.goal.startAt)} -{" "}
                          {formatDate(currentGoal.goal.dueAt)}
                        </p>
                      </div>
                      <div className="flex flex-row items-center gap-x-2 shrink-0">
                        <details className="relative">
                          <summary
                            className="border border-white/20 rounded p-2 h-10 w-10 flex items-center justify-center cursor-pointer list-none text-white hover:bg-white/10 [&::-webkit-details-marker]:hidden"
                            aria-label="Edit invitation goal"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </summary>
                          <div className="absolute right-0 top-12 z-20 w-72 rounded border border-zinc-200 bg-white p-4 text-black shadow-lg">
                            <p className="text-sm font-semibold">Edit goal</p>
                            <div className="mt-3 grid grid-cols-1 gap-3">
                              <label className="flex flex-col gap-y-1 min-w-0">
                                <span className="text-xs font-semibold text-zinc-500">
                                  Target successful invitations
                                </span>
                                <input
                                  className="border border-zinc-200 rounded px-3 py-2 h-11 w-full min-w-0"
                                  type="number"
                                  min={1}
                                  inputMode="numeric"
                                  value={editGoalTarget}
                                  disabled={isUpdatingGoal}
                                  onChange={(event) =>
                                    handleEditGoalTargetChange(
                                      event.target.value,
                                    )
                                  }
                                />
                              </label>
                              <label className="flex flex-col gap-y-1 min-w-0">
                                <span className="text-xs font-semibold text-zinc-500">
                                  Goal start
                                </span>
                                <input
                                  className="border border-zinc-200 rounded px-3 py-2 h-11 w-full min-w-0"
                                  type="date"
                                  value={editGoalStartDate}
                                  disabled={isUpdatingGoal}
                                  onChange={(event) =>
                                    handleEditGoalStartDateChange(
                                      event.target.value,
                                    )
                                  }
                                />
                              </label>
                              <label className="flex flex-col gap-y-1 min-w-0">
                                <span className="text-xs font-semibold text-zinc-500">
                                  Goal end
                                </span>
                                <input
                                  className="border border-zinc-200 rounded px-3 py-2 h-11 w-full min-w-0"
                                  type="date"
                                  value={editGoalDueDate}
                                  disabled={isUpdatingGoal}
                                  onChange={(event) =>
                                    handleEditGoalDueDateChange(
                                      event.target.value,
                                    )
                                  }
                                />
                              </label>
                              {isUpdatingGoal && !goalEditMessage && (
                                <p className="text-sm text-zinc-500">
                                  Saving...
                                </p>
                              )}
                              {goalEditMessage && (
                                <p className="text-sm text-red-500">
                                  {goalEditMessage}
                                </p>
                              )}
                            </div>
                          </div>
                        </details>
                        <button
                          className="border border-red-200/70 bg-red-500/10 text-red-100 rounded p-2 disabled:opacity-40 h-10 w-10 flex items-center justify-center hover:bg-red-500/20 hover:border-red-200"
                          type="button"
                          aria-label="Delete invitation goal"
                          disabled={isDeletingGoal}
                          onClick={handleDeleteGoal}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-y-1">
                      <div className="w-full h-4 bg-white/20 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white rounded-full transition-[width] duration-300 ease-out"
                          style={{ width: `${currentGoalProgressPercent}%` }}
                          role="progressbar"
                          aria-valuenow={
                            currentGoal.stats.goalSuccessfulRecruits
                          }
                          aria-valuemin={0}
                          aria-valuemax={
                            currentGoal.goal.targetSuccessfulRecruits
                          }
                          aria-label="Successful invitations toward invitation goal"
                        />
                      </div>
                      <p className="text-sm sm:text-base tabular-nums">
                        <span className="font-semibold text-white">
                          {currentGoal.stats.goalSuccessfulRecruits}
                        </span>
                        <span className="text-white/70">
                          {" "}
                          / {currentGoal.goal.targetSuccessfulRecruits}{" "}
                          successful invitations
                        </span>
                      </p>
                      <div className="mt-2">
                        <div className="rounded border border-white/15 bg-white/10 px-3 py-2">
                          <p className="text-xs font-semibold text-white/65">
                            Invites created
                          </p>
                          <p className="text-lg font-semibold tabular-nums">
                            {currentGoalInvitesCreated}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {pastGoals.length > 0 && (
                  <details className="rounded border border-white/15 bg-white/10 px-4 py-3 text-sm">
                    <summary className="cursor-pointer font-medium text-white/80">
                      View past goals
                    </summary>
                    <div className="mt-3 flex flex-col divide-y divide-white/15">
                      {pastGoals.map((goal) => (
                        <div
                          key={goal.goal.id}
                          className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
                        >
                          <p className="text-white/70">
                            {formatDate(goal.goal.startAt)} -{" "}
                            {formatDate(goal.goal.dueAt)}
                          </p>
                          <p className="tabular-nums">
                            <span className="font-semibold text-white">
                              {goal.stats.goalSuccessfulRecruits}
                            </span>
                            <span className="text-white/70">
                              {" "}
                              / {goal.goal.targetSuccessfulRecruits} successful
                              invitations
                            </span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {showProminentGoalForm && (
                  <div className="rounded border border-white/15 bg-white/10 p-4 sm:p-5 flex flex-col gap-y-3">
                    <div>
                      <p className="font-semibold text-lg">
                        {currentGoal ? "Set a new goal" : "Set a goal"}
                      </p>
                      <p className="text-sm text-white/70">
                        New goals can start in the past, but they cannot overlap
                        another invite goal.
                      </p>
                    </div>

                    <form
                      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 items-end"
                      onSubmit={handleSetGoal}
                    >
                      <label className="flex flex-col gap-y-1 min-w-0">
                        <span className="text-xs font-semibold text-white/70">
                          Target successful invitations
                        </span>
                        <input
                          className="border border-zinc-200 rounded px-3 py-2 h-11 w-full min-w-0 bg-white text-black"
                          type="number"
                          min={1}
                          inputMode="numeric"
                          placeholder="10"
                          value={goalTarget}
                          onChange={(event) =>
                            setGoalTarget(event.target.value)
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-y-1 min-w-0">
                        <span className="text-xs font-semibold text-white/70">
                          Start date
                        </span>
                        <input
                          className="border border-zinc-200 rounded px-3 py-2 h-11 w-full min-w-0 bg-white text-black"
                          type="date"
                          value={goalStartDate}
                          onChange={(event) =>
                            setGoalStartDate(event.target.value)
                          }
                        />
                      </label>
                      <label className="flex flex-col gap-y-1 min-w-0">
                        <span className="text-xs font-semibold text-white/70">
                          End date
                        </span>
                        <input
                          className="border border-zinc-200 rounded px-3 py-2 h-11 w-full min-w-0 bg-white text-black"
                          type="date"
                          value={goalDueDate}
                          onChange={(event) =>
                            setGoalDueDate(event.target.value)
                          }
                        />
                      </label>
                      <button
                        className="bg-white text-green-bg-card rounded px-5 py-2 h-11 disabled:opacity-50 whitespace-nowrap w-full sm:col-span-2 lg:col-span-1 lg:w-auto lg:min-w-32 font-semibold hover:bg-white/90"
                        type="submit"
                        disabled={isCreatingGoal}
                      >
                        Set goal
                      </button>
                      {goalFormMessage && (
                        <p className="sm:col-span-2 lg:col-span-3 text-sm text-red-100">
                          {goalFormMessage}
                        </p>
                      )}
                    </form>
                  </div>
                )}

                <p className="text-sm text-white/70 leading-snug">
                  Successful invitations are people you invited who signed their
                  membership contract.
                </p>
              </div>
            )}
          </Card>
        )}

        <div className="flex flex-col gap-y-6">
          <InviteForm
            onInviteCreated={handleInviteCreated}
            onReusableInviteCreated={handleReusableInviteCreated}
          />
        </div>

        {(showInviteTypeTabs ||
          showingIndividualInvites ||
          showingGroupInvites) && (
          <div className="flex flex-col gap-y-6 pt-5">
            {showInviteTypeTabs && (
              <div className="flex flex-row gap-x-2 justify-start">
                {INVITE_LIST_TABS.map((tab) => (
                  <Button
                    color={ButtonColor.Transparent}
                    key={tab}
                    onClick={() => setInviteListTab(tab)}
                    aria-pressed={inviteListTab === tab}
                    className={cn(
                      "!border-b-[2px] rounded-none",
                      inviteListTab === tab
                        ? "border-b-green! text-black"
                        : "border-b-transparent! hover:border-b-zinc-200! text-zinc-500",
                    )}
                  >
                    <p className="text-base">{INVITE_LIST_TAB_LABELS[tab]}</p>
                  </Button>
                ))}
              </div>
            )}
            {showingIndividualInvites && (
              <div className="flex flex-col gap-y-12">
                {isError && (
                  <p className="text-red-500 text-sm">Failed to load invites</p>
                )}

                {actionable.length > 0 && (
                  <div className="flex flex-col gap-y-4">
                    <p className="font-semibold text-2xl">
                      {inviteBuckets.actionable.title}
                    </p>
                    <ExpandableList>
                      {actionable.map((request) => (
                        <OnetimeInviteListItem
                          key={request.id}
                          invite={request}
                          showCommunityLabel={true}
                          communityLabel={request.community?.name}
                          selfInvited={user.id === request.invitingUser?.id}
                          onApprove={handleApproveInvite}
                          onReject={handleRejectInvite}
                        />
                      ))}
                    </ExpandableList>
                  </div>
                )}

                {unverifiableActionable.length > 0 && (
                  <div className="flex flex-col gap-y-4">
                    <div className="flex flex-col gap-y-1">
                      <p className="font-semibold text-2xl">
                        {inviteBuckets.unverifiableActionable.title}
                      </p>
                      <p className="text-zinc-500">
                        {inviteBuckets.unverifiableActionable.description}
                      </p>
                    </div>
                    <ExpandableList>
                      {unverifiableActionable.map((invite) => (
                        <OnetimeInviteListItem
                          key={invite.id}
                          invite={invite}
                          showCommunityLabel={true}
                          communityLabel={invite.community?.name}
                          selfInvited={user.id === invite.invitingUser?.id}
                          copied={copiedInviteId === invite.id}
                          onDelete={handleDeleteInvite}
                          onOpenSettings={
                            user.id === invite.invitingUser?.id
                              ? setSettingsInviteId
                              : undefined
                          }
                          onCopy={copyToClipboard}
                          onCopied={handleCopied}
                        />
                      ))}
                    </ExpandableList>
                  </div>
                )}

                {waitingForResponse.length > 0 && (
                  <div className="flex flex-col gap-y-4">
                    <div className="flex flex-col gap-y-1">
                      <p className="font-semibold text-2xl">
                        {inviteBuckets.waitingForResponse.title}
                      </p>
                      <p className="text-zinc-500">
                        {inviteBuckets.waitingForResponse.description}
                      </p>
                    </div>
                    <ExpandableList>
                      {waitingForResponse.map((request) => (
                        <OnetimeInviteListItem
                          key={request.id}
                          invite={request}
                          showCommunityLabel={true}
                          communityLabel={request.community?.name}
                          selfInvited={user.id === request.invitingUser?.id}
                          onDelete={(inviteId) => handleDeleteRequest(inviteId)}
                        />
                      ))}
                    </ExpandableList>
                  </div>
                )}

                {settled.length > 0 && (
                  <div className="flex flex-col gap-y-4">
                    <div className="flex flex-col gap-y-1">
                      <p className="font-semibold text-2xl">
                        {inviteBuckets.settled.title}
                      </p>
                      <p className="text-zinc-500">
                        {inviteBuckets.settled.description}
                      </p>
                    </div>
                    <ExpandableList>
                      {settled.map((invite) => (
                        <OnetimeInviteListItem
                          key={invite.id}
                          invite={invite}
                          showCommunityLabel={true}
                          communityLabel={invite.community?.name}
                          selfInvited={user.id === invite.invitingUser?.id}
                          copied={copiedInviteId === invite.id}
                          onDelete={handleDeleteInvite}
                          onCopy={copyToClipboard}
                          onCopied={handleCopied}
                        />
                      ))}
                    </ExpandableList>
                  </div>
                )}
              </div>
            )}
            {showingGroupInvites && <InviteShareLink />}
          </div>
        )}
        {settingsTarget && (
          <InviteSettingsModal
            target={settingsTarget}
            leaderCommunities={leaderCommunities}
            onClose={() => setSettingsInviteId(null)}
          />
        )}
      </div>
    </CenterLayout>
  );
};

export default InvitesPage;
