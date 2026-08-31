import { errorMessage } from "@alliance/common/errorMessage";
import { formatPhoneNumberForDisplay } from "@alliance/common/phone";
import {
  actionsActionRelationsForUserAdmin,
  analyticsGetTimeSpentPerUserAdmin,
  analyticsGetTimeSpentPerUserTotalAdmin,
  communityAddMemberAdmin,
  communityGetCommunitiesAdmin,
  communityMoveMemberAdmin,
  contractSuspendContractAdmin,
  notifsNotifsForUserAdmin,
  tasksGetFormsForUserSidAdmin,
  userAddUserToTagAdmin,
  userCreateAwayRangeAdmin,
  userDeleteAwayRangeAdmin,
  userGetAwayRangeForUserAdmin,
  userGetTagSummariesAdmin,
  userListFriends,
  userRemoveUserFromTagAdmin,
  userUpdateAwayRangeAdmin,
  userUpdateUserRolesAdmin,
  userUserDetailAdmin,
} from "@alliance/shared/client";
import {
  ActionEventNotifDto,
  CommunityDto,
  ProfileDto,
  Push,
  TagDto,
  TagSummaryDto,
  TimeSpentForUserDto,
  UserActionRelationDetailDto,
  UserActionRelationsResponseDto,
  UserActionSummaryDto,
  UserAdminDetailDto,
  UserAdminInvitedByDto,
  UserAwayRangeDto,
  UserAwayRangeReason,
} from "@alliance/shared/client/types.gen";
import { getMemberCount } from "@alliance/shared/lib/communityUtils";
import { cn } from "@alliance/shared/styles/util";
import { getApiUrl } from "../lib/config";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import FormInput from "@alliance/sharedweb/ui/FormInput";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@alliance/sharedweb/ui/HoverCard";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { PILL_STATUS_DATA } from "@alliance/sharedweb/ui/UserProgressPills";
import { keyBy } from "es-toolkit";
import {
  ChevronDown,
  ChevronRight,
  Globe,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLoaderData, useNavigate } from "react-router";
import { Route } from "../../.react-router/types/src/pages/+types/UserDetailView";
import CreateActivityControls from "../components/CreateActivityControls";
import DeleteAccountModal from "../components/DeleteAccountModal";

const AWAY_REASON_OPTIONS = [
  { value: "vacation", label: "Vacation" },
  { value: "emergency", label: "Emergency" },
  { value: "other", label: "Other" },
] satisfies Array<{ value: UserAwayRangeReason; label: string }>;

const AWAY_REASON_LABELS = {
  vacation: "Vacation",
  emergency: "Emergency",
  other: "Other",
} satisfies Record<UserAwayRangeReason, string>;

export async function clientLoader({ params }: Route.LoaderArgs) {
  const userIdParam = params.userId;
  if (!userIdParam) {
    throw new Error("Not found");
  }
  const userId = Number.parseInt(userIdParam, 10);
  if (Number.isNaN(userId)) {
    throw new Error("Not found");
  }

  const [
    userRes,
    awayRangesRes,
    tagsRes,
    actionRelationsRes,
    timeSpentRes,
    timeSpentTotalRes,
    notifRes,
    formResponsesRes,
    friendsRes,
    communitiesRes,
  ] = await Promise.all([
    userUserDetailAdmin({ path: { id: userId } }),
    userGetAwayRangeForUserAdmin({ path: { id: userId } }),
    userGetTagSummariesAdmin(),
    actionsActionRelationsForUserAdmin({ path: { userId } }),
    analyticsGetTimeSpentPerUserAdmin(),
    analyticsGetTimeSpentPerUserTotalAdmin(),
    notifsNotifsForUserAdmin({ path: { id: userId } }),
    tasksGetFormsForUserSidAdmin({ path: { userId } }).catch(() => ({
      data: [],
    })),
    userListFriends({ path: { id: userId } }),
    communityGetCommunitiesAdmin(),
  ]);

  const user = userRes.data;
  if (!user) {
    throw new Error("Not found");
  }

  const awayRanges = awayRangesRes.data ?? [];
  const timeSpent = findTimeForUser(timeSpentRes.data ?? [], userId);
  const timeSpentTotal = findTimeForUser(timeSpentTotalRes.data ?? [], userId);

  const actionData: UserActionRelationsResponseDto | undefined =
    actionRelationsRes.data;
  const actionSummaries: UserActionSummaryDto[] = actionData?.actions ?? [];
  const actionRelations: UserActionRelationDetailDto[] =
    actionData?.users?.find((entry) => entry.userId === userId)?.relations ??
    [];

  return {
    user,
    allTags: tagsRes.data ?? [],
    actionSummaries,
    actionRelations,
    timeSpent,
    timeSpentTotal,
    awayRanges,
    notifs: notifRes.data ?? [],
    formResponses: formResponsesRes.data ?? [],
    friends: friendsRes.data ?? [],
    communities: communitiesRes.data ?? [],
  };
}

const UserDetailView: React.FC = () => {
  const loaderData = useLoaderData<typeof clientLoader>();
  const {
    actionSummaries,
    actionRelations,
    awayRanges,
    notifs,
    formResponses,
    friends,
  } = loaderData;

  const [user, setUser] = useState<UserAdminDetailDto>(loaderData.user);
  const [communities, setCommunities] = useState<CommunityDto[]>(
    loaderData.communities,
  );
  const [actionRelationsState, setActionRelationsState] =
    useState<UserActionRelationDetailDto[]>(actionRelations);
  const [allTags, setAllTags] = useState<TagSummaryDto[]>(loaderData.allTags);
  const [pendingTagOps, setPendingTagOps] = useState<Set<string>>(
    () => new Set(),
  );
  const [tagMutationError, setTagMutationError] = useState<string | null>(null);
  const [isAmbassadorPending, setIsAmbassadorPending] = useState(false);
  const [isStaffPending, setIsStaffPending] = useState(false);
  const [roleMutationError, setRoleMutationError] = useState<string | null>(
    null,
  );
  const [isSuspendPending, setIsSuspendPending] = useState(false);
  const [suspendMutationError, setSuspendMutationError] = useState<
    string | null
  >(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [expandedEmailId, setExpandedEmailId] = useState<number | null>(null);
  const [awayRangesState, setAwayRangesState] =
    useState<UserAwayRangeDto[]>(awayRanges);
  const [awayStartDate, setAwayStartDate] = useState("");
  const [awayEndDate, setAwayEndDate] = useState("");
  const [awayReason, setAwayReason] = useState<UserAwayRangeReason | "">("");
  const [awayNote, setAwayNote] = useState("");
  const [awayMutationError, setAwayMutationError] = useState<string | null>(
    null,
  );
  const [isAwayMutationPending, setIsAwayMutationPending] = useState(false);
  const [editingAwayRangeId, setEditingAwayRangeId] = useState<number | null>(
    null,
  );
  const [editAwayStartDate, setEditAwayStartDate] = useState("");
  const [editAwayEndDate, setEditAwayEndDate] = useState("");
  const [editAwayReason, setEditAwayReason] = useState<
    UserAwayRangeReason | ""
  >("");
  const [editAwayNote, setEditAwayNote] = useState("");
  const { confirm, success } = useToast();

  useEffect(() => {
    setUser(loaderData.user);
  }, [loaderData.user]);

  useEffect(() => {
    setActionRelationsState(actionRelations);
  }, [actionRelations]);

  useEffect(() => {
    setAwayRangesState(awayRanges);
  }, [awayRanges]);

  const sortedAllTags = useMemo(() => {
    return [...allTags].sort((a, b) => a.name.localeCompare(b.name));
  }, [allTags]);

  const navigate = useNavigate();

  const upsertActionRelation = useCallback(() => {
    navigate(window.location.pathname);
  }, [navigate]);

  const [userTagIds, setUserTagIds] = useState<Set<string>>(
    () => new Set((user.tags ?? []).map((tag) => tag.id)),
  );

  useEffect(() => {
    setUserTagIds(new Set((user.tags ?? []).map((tag) => tag.id)));
  }, [user.tags]);

  useEffect(() => {
    setAllTags(loaderData.allTags);
  }, [loaderData.allTags]);

  const userTags = useMemo(() => {
    return allTags.filter((tag) => userTagIds.has(tag.id));
  }, [allTags, userTagIds]);

  const relationByActionId = useMemo(
    () => keyBy(actionRelationsState, (relation) => relation.actionId),
    [actionRelationsState],
  );

  const { emailNotifs, textNotifs, pushNotifs } = useMemo(() => {
    // Categorize each channel independently
    const email: ActionEventNotifDto[] = [];
    const text: ActionEventNotifDto[] = [];
    const push: Push[] = [];
    notifs.forEach((notif) => {
      if (notif.mail) email.push(notif);
      if (notif.mms) text.push(notif);
      notif.pushes?.forEach((p) => push.push(p));
    });
    const sortDesc = (arr: ActionEventNotifDto[]) =>
      [...arr].sort((a, b) => notifTimestamp(b) - notifTimestamp(a));
    return {
      emailNotifs: sortDesc(email),
      textNotifs: sortDesc(text),
      pushNotifs: [...push].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    };
  }, [notifs]);

  const emailClickRate = useMemo(() => {
    if (!emailNotifs.length) return null;
    const clicked = emailNotifs.filter((n) => n.mail?.clickedLink).length;
    return Math.round((clicked / emailNotifs.length) * 100);
  }, [emailNotifs]);

  const textClickRate = useMemo(() => {
    if (!textNotifs.length) return null;
    const clicked = textNotifs.filter((n) => n.mms?.clickedLink).length;
    return Math.round((clicked / textNotifs.length) * 100);
  }, [textNotifs]);

  const pushOpenRate = useMemo(() => {
    if (!pushNotifs.length) return null;
    const opened = pushNotifs.filter((p) => p.openedAt).length;
    return Math.round((opened / pushNotifs.length) * 100);
  }, [pushNotifs]);

  const sortedAwayRanges = useMemo(() => {
    return [...awayRangesState].sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    );
  }, [awayRangesState]);

  const currentAwayRange = useMemo(() => {
    const now = new Date();
    return (
      sortedAwayRanges.find((range) => {
        const start = new Date(range.startDate);
        const end = new Date(range.endDate);
        return start <= now && now <= end;
      }) ?? null
    );
  }, [sortedAwayRanges]);

  const latestEvent = user.contractEvents?.length
    ? [...user.contractEvents].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      )[0]
    : null;

  const sortedFormResponses = useMemo(() => {
    return [...formResponses].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [formResponses]);

  const contractStatusColor =
    latestEvent === null
      ? "text-zinc-500"
      : latestEvent.type === "signed"
        ? "text-green"
        : "text-red-700";

  const contractStatus =
    latestEvent === null
      ? "Not signed"
      : latestEvent.type === "signed"
        ? "Signed"
        : "Suspended";
  const tagKey = useCallback(
    (tagId: string) => `${user.id}-${tagId}`,
    [user.id],
  );

  const updateTagInState = useCallback((updatedTag: TagDto) => {
    const summary: TagSummaryDto = {
      id: updatedTag.id,
      name: updatedTag.name,
      description: updatedTag.description,
      publicDisplayName: updatedTag.publicDisplayName,
      createdAt: updatedTag.createdAt,
      updatedAt: updatedTag.updatedAt,
    };
    setAllTags((prev) => {
      const exists = prev.some((tag) => tag.id === summary.id);
      if (exists) {
        return prev.map((tag) => (tag.id === summary.id ? summary : tag));
      }
      return [...prev, summary];
    });
  }, []);

  const handleTagToggle = useCallback(
    async (tagId: string, nextChecked: boolean) => {
      const key = tagKey(tagId);
      setPendingTagOps((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      setTagMutationError(null);
      try {
        if (nextChecked) {
          const res = await userAddUserToTagAdmin({
            path: { tagId },
            body: { userId: user.id },
          });
          if (res.data) {
            updateTagInState(res.data);
            setUserTagIds((prev) => new Set([...prev, tagId]));
          }
        } else {
          const res = await userRemoveUserFromTagAdmin({
            path: { tagId },
            body: { userId: user.id },
          });
          if (res.data) {
            updateTagInState(res.data);
            setUserTagIds((prev) => {
              const next = new Set(prev);
              next.delete(tagId);
              return next;
            });
          }
        }
      } catch (error) {
        console.error("Failed to update tag membership", error);
        setTagMutationError("Failed to update tag membership. Try again.");
      } finally {
        setPendingTagOps((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    },
    [tagKey, updateTagInState, user.id],
  );

  const handleAmbassadorToggle = useCallback(
    async (nextChecked: boolean) => {
      setIsAmbassadorPending(true);
      setRoleMutationError(null);
      try {
        const res = await userUpdateUserRolesAdmin({
          path: { id: user.id },
          body: { ambassador: nextChecked },
        });
        if (res.data) {
          setUser(res.data);
        }
      } catch (error) {
        console.error("Failed to update user role", error);
        setRoleMutationError("Failed to update role. Try again.");
      } finally {
        setIsAmbassadorPending(false);
      }
    },
    [user.id],
  );

  const handleStaffToggle = useCallback(
    async (nextChecked: boolean) => {
      setIsStaffPending(true);
      setRoleMutationError(null);
      try {
        const res = await userUpdateUserRolesAdmin({
          path: { id: user.id },
          body: { staff: nextChecked },
        });
        if (res.data) {
          setUser(res.data);
        }
      } catch (error) {
        console.error("Failed to update user role", error);
        setRoleMutationError("Failed to update role. Try again.");
      } finally {
        setIsStaffPending(false);
      }
    },
    [user.id],
  );

  const handleSuspendContract = useCallback(async () => {
    const confirmed = await confirm({
      title: "Suspend contract?",
      message: `Suspend ${user.name}'s contract and remove them from their current groups?`,
    });
    if (!confirmed) return;

    setIsSuspendPending(true);
    setSuspendMutationError(null);
    try {
      await contractSuspendContractAdmin({ path: { userId: user.id } });
      const refreshed = await userUserDetailAdmin({ path: { id: user.id } });
      if (refreshed.data) {
        setUser(refreshed.data);
      }
      success("Contract suspended", user.name);
    } catch (error) {
      console.error("Failed to suspend contract", error);
      setSuspendMutationError("Failed to suspend contract. Try again.");
    } finally {
      setIsSuspendPending(false);
    }
  }, [confirm, success, user.id, user.name]);

  const resetAwayCreateForm = useCallback(() => {
    setAwayStartDate("");
    setAwayEndDate("");
    setAwayReason("");
    setAwayNote("");
  }, []);

  const cancelAwayEdit = useCallback(() => {
    setEditingAwayRangeId(null);
    setEditAwayStartDate("");
    setEditAwayEndDate("");
    setEditAwayReason("");
    setEditAwayNote("");
  }, []);

  const startAwayEdit = useCallback((range: UserAwayRangeDto) => {
    setEditingAwayRangeId(range.id);
    setEditAwayStartDate(formatDateForInput(range.startDate));
    setEditAwayEndDate(formatDateForInput(range.endDate));
    setEditAwayReason(range.reason);
    setEditAwayNote(range.note ?? "");
    setAwayMutationError(null);
  }, []);

  const handleCreateAwayRange = useCallback(async () => {
    setAwayMutationError(null);

    if (!awayStartDate || !awayEndDate || !awayReason) {
      setAwayMutationError("Choose dates and a reason.");
      return;
    }

    if (awayReason === "other" && !awayNote.trim()) {
      setAwayMutationError("Add a note for an Other away period.");
      return;
    }

    setIsAwayMutationPending(true);
    try {
      const response = await userCreateAwayRangeAdmin({
        path: { userId: user.id },
        body: {
          startDay: awayStartDate,
          endDay: awayEndDate,
          reason: awayReason,
          note: awayNote.trim() || null,
        },
        throwOnError: true,
      });
      setAwayRangesState((prev) => [...prev, response.data]);
      resetAwayCreateForm();
      success("Away period scheduled", user.name);
    } catch (error) {
      setAwayMutationError(
        errorMessage({ error, fallback: "Could not schedule away period." }),
      );
    } finally {
      setIsAwayMutationPending(false);
    }
  }, [
    awayEndDate,
    awayNote,
    awayReason,
    awayStartDate,
    resetAwayCreateForm,
    success,
    user.id,
    user.name,
  ]);

  const handleUpdateAwayRange = useCallback(async () => {
    if (!editingAwayRangeId) return;

    setAwayMutationError(null);

    if (!editAwayStartDate || !editAwayEndDate || !editAwayReason) {
      setAwayMutationError("Choose dates and a reason.");
      return;
    }

    if (editAwayReason === "other" && !editAwayNote.trim()) {
      setAwayMutationError("Add a note for an Other away period.");
      return;
    }

    setIsAwayMutationPending(true);
    try {
      const response = await userUpdateAwayRangeAdmin({
        path: { userId: user.id, id: editingAwayRangeId },
        body: {
          startDay: editAwayStartDate,
          endDay: editAwayEndDate,
          reason: editAwayReason,
          note: editAwayNote.trim() || null,
        },
        throwOnError: true,
      });
      setAwayRangesState((prev) =>
        prev.map((range) =>
          range.id === response.data.id ? response.data : range,
        ),
      );
      cancelAwayEdit();
      success("Away period updated", user.name);
    } catch (error) {
      setAwayMutationError(
        errorMessage({ error, fallback: "Could not update away period." }),
      );
    } finally {
      setIsAwayMutationPending(false);
    }
  }, [
    cancelAwayEdit,
    editAwayEndDate,
    editAwayNote,
    editAwayReason,
    editAwayStartDate,
    editingAwayRangeId,
    success,
    user.id,
    user.name,
  ]);

  const handleDeleteAwayRange = useCallback(
    async (range: UserAwayRangeDto) => {
      const confirmed = await confirm({
        title: "Delete away period?",
        message: `Delete ${formatAwayRange(range)} for ${user.name}?`,
      });
      if (!confirmed) return;

      setAwayMutationError(null);
      setIsAwayMutationPending(true);
      try {
        await userDeleteAwayRangeAdmin({
          path: { userId: user.id, id: range.id },
          throwOnError: true,
        });
        setAwayRangesState((prev) =>
          prev.filter((existing) => existing.id !== range.id),
        );
        if (editingAwayRangeId === range.id) {
          cancelAwayEdit();
        }
        success("Away period deleted", user.name);
      } catch (error) {
        setAwayMutationError(
          errorMessage({ error, fallback: "Could not delete away period." }),
        );
      } finally {
        setIsAwayMutationPending(false);
      }
    },
    [cancelAwayEdit, confirm, editingAwayRangeId, success, user.id, user.name],
  );

  return (
    <div className="p-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4 pb-4 border-b border-zinc-200 mb-4">
        <AvatarProfile pfp={user.profilePicture} size="huge" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-semibold text-zinc-900">{user.name}</h1>
            <span className={cn("text-sm font-medium", contractStatusColor)}>
              {contractStatus}
            </span>
            {currentAwayRange && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                Away
              </span>
            )}
            <Button
              color={ButtonColor.Stone}
              onClick={() => {
                const apiUrl = getApiUrl();
                window.open(`${apiUrl}/auth/impersonate/${user.id}`, "_blank");
              }}
              size="small"
            >
              Log in as user
            </Button>
            <Button
              color={ButtonColor.Red}
              onClick={handleSuspendContract}
              disabled={!user.hasActiveContract || isSuspendPending}
              size="small"
              title={
                user.hasActiveContract
                  ? "Suspend this member's contract"
                  : "This member does not have an active contract"
              }
            >
              {isSuspendPending ? "Suspending..." : "Suspend contract"}
            </Button>
            <Button
              color={ButtonColor.Red}
              onClick={() => setIsDeleteModalOpen(true)}
              size="small"
              title="Permanently delete this member's account"
            >
              <Trash2 size={14} className="inline mr-1" />
              Delete account
            </Button>
          </div>
          {suspendMutationError && (
            <p className="text-xs text-red-500 mt-2">{suspendMutationError}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-zinc-600 mt-3">
            <span>
              <Mail size={16} className="text-zinc-500 inline mr-1" />
              {user.email}
            </span>
            {user.phoneNumber && (
              <span className="text-zinc-400">
                <Phone size={16} className="text-zinc-500 inline mr-1" />
                {formatPhoneNumberForDisplay(user.phoneNumber)}
              </span>
            )}
            <span className="text-zinc-400">ID: {user.id}</span>
          </div>
          <div className="flex items-center gap-3 mt-3 text-sm">
            <span
              className={
                user.emailNotifsForActions ? "text-green-600" : "text-zinc-400"
              }
            >
              Email {user.emailNotifsForActions ? "on" : "off"}
            </span>
            <span
              className={
                user.textNotifsForActions ? "text-green-600" : "text-zinc-400"
              }
            >
              Text {user.textNotifsForActions ? "on" : "off"}
            </span>
            <span
              className={
                user.pushNotifsForActions ? "text-green-600" : "text-zinc-400"
              }
            >
              Push {user.pushNotifsForActions ? "on" : "off"}
            </span>
            {user.turnedOffAllNotifs && (
              <span className="text-red-500 font-medium">All notifs off</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <section className="max-h-128 overflow-y-auto">
            {actionSummaries.length ? (
              <div className="border border-zinc-200 rounded overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-100 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium text-zinc-600">
                        Action
                      </th>
                      <th className="px-3 py-2 font-medium text-zinc-600">
                        Status
                      </th>
                      <th className="px-3 py-2 font-medium text-zinc-600 text-nowrap">
                        User Status
                      </th>
                      <th className="px-3 py-2 font-medium text-zinc-600 text-nowrap">
                        Last Activity
                      </th>
                      <th className="px-3 py-2 font-medium text-zinc-600">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {actionSummaries.map((action) => {
                      const relation = relationByActionId[action.id];
                      const { pillLabel, pillTextStyle } =
                        PILL_STATUS_DATA[relation.status];
                      return (
                        <tr key={action.id} className="hover:bg-zinc-50">
                          <td className="px-3 py-2">
                            <Link
                              to={`/actions/${action.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              {action.name}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-zinc-500">
                            {humanize(action.status)}
                          </td>
                          <td className="px-3 py-2">
                            {relation.status === "wont_complete" &&
                            (relation.declineReason ||
                              relation.isMoral ||
                              relation.outOfTime) ? (
                              <HoverCard>
                                <HoverCardTrigger
                                  render={
                                    <span
                                      className={cn(
                                        "font-medium cursor-default",
                                        pillTextStyle,
                                      )}
                                    >
                                      {pillLabel}
                                    </span>
                                  }
                                />
                                <HoverCardContent>
                                  <div className="flex flex-col items-center gap-0.5">
                                    {relation.outOfTime && (
                                      <span className="text-orange-600">
                                        Out of time
                                      </span>
                                    )}
                                    {relation.isMoral && (
                                      <span className="text-amber-600">
                                        Moral objection
                                      </span>
                                    )}
                                    {relation.declineReason && (
                                      <span className="text-zinc-500">
                                        {relation.declineReason}
                                      </span>
                                    )}
                                  </div>
                                </HoverCardContent>
                              </HoverCard>
                            ) : (
                              <span
                                className={cn("font-medium", pillTextStyle)}
                              >
                                {pillLabel}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-zinc-500">
                            {relation.latestActivityAt
                              ? new Date(
                                  relation.latestActivityAt,
                                ).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <CreateActivityControls
                              actionId={action.id}
                              userId={user.id}
                              onCreated={upsertActionRelation}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No actions tracked.</p>
            )}
          </section>

          {/* Notifications Tables */}
          <section>
            <h2 className="text-sm font-semibold text-zinc-700 mb-2">
              Notifications ({notifs.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Texts */}
              <div className="border border-zinc-200 rounded overflow-hidden">
                <div className="bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600 border-b border-zinc-200 flex items-center justify-between">
                  <span>Texts ({textNotifs.length})</span>
                  {textClickRate !== null && (
                    <span className="font-normal text-zinc-500">
                      {textClickRate}% click rate
                    </span>
                  )}
                </div>
                {textNotifs.length ? (
                  <div className="max-h-64 overflow-y-auto divide-y divide-zinc-100">
                    {textNotifs.map((notif) => {
                      const mms = notif.mms;
                      const status =
                        mms?.status || (notif.sent ? "sent" : "pending");
                      return (
                        <div
                          key={keyForNotif(notif)}
                          className="px-3 py-2 text-xs hover:bg-zinc-50 flex flex-row items-center w-full"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={cn(
                                  "font-medium",
                                  ["sent", "delivered"].includes(
                                    status.toLowerCase(),
                                  )
                                    ? "text-green-600"
                                    : ["failed", "undelivered"].includes(
                                          status.toLowerCase(),
                                        )
                                      ? "text-red-600"
                                      : "text-amber-600",
                                )}
                              >
                                {status}
                              </span>
                              <span className="text-zinc-400">
                                {mms?.createdAt &&
                                  new Date(mms.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            {mms?.body && (
                              <p className="text-zinc-600 line-clamp-2 mt-0.5">
                                {mms.body}
                              </p>
                            )}
                            {mms?.clickedLink && (
                              <span className="text-green-600">
                                Link clicked
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="px-3 py-2 text-xs text-zinc-500">
                    No texts sent.
                  </p>
                )}
              </div>

              {/* Emails */}
              <div className="border border-zinc-200 rounded overflow-hidden">
                <div className="bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600 border-b border-zinc-200 flex items-center justify-between">
                  <span>Emails ({emailNotifs.length})</span>
                  {emailClickRate !== null && (
                    <span className="font-normal text-zinc-500">
                      {emailClickRate}% click rate
                    </span>
                  )}
                </div>
                {emailNotifs.length ? (
                  <div className="max-h-96 overflow-y-auto divide-y divide-zinc-100">
                    {emailNotifs.map((notif) => {
                      const mail = notif.mail;
                      const isExpanded = expandedEmailId === mail?.id;
                      return (
                        <div key={keyForNotif(notif)}>
                          <div
                            className="px-3 py-2 text-xs hover:bg-zinc-50 cursor-pointer"
                            onClick={() =>
                              setExpandedEmailId(
                                isExpanded ? null : (mail?.id ?? null),
                              )
                            }
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-zinc-400">
                                  {isExpanded ? (
                                    <ChevronDown size={16} />
                                  ) : (
                                    <ChevronRight size={16} />
                                  )}
                                </span>
                                <span
                                  className={cn(
                                    "font-medium",
                                    mail?.status?.toLowerCase() === "sent"
                                      ? "text-green-600"
                                      : mail?.status?.toLowerCase() === "failed"
                                        ? "text-red-600"
                                        : "text-amber-600",
                                  )}
                                >
                                  {mail?.status || "unknown"}
                                </span>
                              </div>
                              <span className="text-zinc-400">
                                {mail?.createdAt &&
                                  new Date(mail.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-zinc-500 truncate mt-0.5 ml-5">
                              {mail?.to}
                            </p>
                            {mail?.clickedLink && (
                              <span className="text-green-600 ml-5">
                                Link clicked
                              </span>
                            )}
                          </div>
                          {isExpanded && mail?.renderedHtml && (
                            <div className="border-t border-zinc-200 bg-white">
                              <iframe
                                srcDoc={mail.renderedHtml}
                                className="w-full h-96 border-0"
                                title="Email preview"
                                sandbox=""
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="px-3 py-2 text-xs text-zinc-500">
                    No emails sent.
                  </p>
                )}
              </div>

              {/* Push */}
              <div className="border border-zinc-200 rounded overflow-hidden">
                <div className="bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600 border-b border-zinc-200 flex items-center justify-between">
                  <span>Push ({pushNotifs.length})</span>
                  {pushOpenRate !== null && (
                    <span className="font-normal text-zinc-500">
                      {pushOpenRate}% open rate
                    </span>
                  )}
                </div>
                {pushNotifs.length ? (
                  <div className="max-h-64 overflow-y-auto divide-y divide-zinc-100">
                    {pushNotifs.map((push) => {
                      const status =
                        push.receiptStatus ||
                        push.ticketStatus ||
                        (push.errorCode ? "error" : "sent");
                      return (
                        <div
                          key={push.id}
                          className="px-3 py-2 text-xs hover:bg-zinc-50 flex flex-row items-center w-full"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <span
                                className={cn(
                                  "font-medium",
                                  ["ok", "delivered"].includes(
                                    status.toLowerCase(),
                                  )
                                    ? "text-green-600"
                                    : ["error", "failed"].includes(
                                          status.toLowerCase(),
                                        )
                                      ? "text-red-600"
                                      : "text-amber-600",
                                )}
                              >
                                {status}
                              </span>
                              <span className="text-zinc-400">
                                {new Date(push.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            {push.body && (
                              <p className="text-zinc-600 line-clamp-2 mt-0.5">
                                {push.body}
                              </p>
                            )}
                            {push.errorMessage && (
                              <p className="text-red-500 line-clamp-2 mt-0.5">
                                {push.errorMessage}
                              </p>
                            )}
                            {push.openedAt && (
                              <span className="text-green-600">Opened</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="px-3 py-2 text-xs text-zinc-500">
                    No push notifications sent.
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Member Info */}
          <section className="border border-zinc-200 rounded p-3">
            <h2 className="text-sm font-semibold text-zinc-700 mb-2">
              Member Info
            </h2>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-1">Bio</p>
                {user.profileDescription?.trim() ? (
                  <p className="text-zinc-800 whitespace-pre-wrap break-words">
                    {user.profileDescription}
                  </p>
                ) : (
                  <p className="text-zinc-500 text-xs">No bio provided.</p>
                )}
              </div>

              <div className="space-y-2">
                <InfoRow icon={<MapPin size={14} />} label="Location">
                  {formatUserLocation(user) ?? "No location provided"}
                </InfoRow>
                <InfoRow icon={<UserPlus size={14} />} label="Invited by">
                  {formatInvitedBy(user)}
                </InfoRow>
                <InfoRow icon={<Globe size={14} />} label="Public profile">
                  {user.shareInfoPublicly ? "Shared publicly" : "Private"}
                </InfoRow>
              </div>

              <dl className="grid grid-cols-1 gap-2 pt-2 border-t border-zinc-100 text-xs">
                <DetailItem label="Anonymous">
                  {user.anonymous ? "Yes" : "No"}
                </DetailItem>
                <DetailItem label="Email with leads">
                  {user.shareEmailWithCommunityLead ? "Shared" : "Private"}
                </DetailItem>
                <DetailItem label="Phone with leads">
                  {user.sharePhoneNumberWithCommunityLead
                    ? "Shared"
                    : "Private"}
                </DetailItem>
                <DetailItem label="Form responses">
                  {humanize(user.formDataPreference)}
                </DetailItem>
                <DetailItem label="Forum digest">
                  {humanize(user.forumDigestPreference)}
                </DetailItem>
                <DetailItem label="Reminder time">
                  {formatReminderTime(user)}
                </DetailItem>
                <DetailItem label="Time zone">
                  {user.timeZone ?? "Not provided"}
                </DetailItem>
                {user.clusterId !== null && (
                  <DetailItem label="Cluster">#{user.clusterId}</DetailItem>
                )}
              </dl>
            </div>
          </section>

          {/* Groups */}
          <MemberGroupMoveSection
            user={user}
            communities={communities}
            onUserUpdated={setUser}
            onCommunitiesUpdated={setCommunities}
          />

          {/* Friends */}
          <section className="border border-zinc-200 rounded p-3">
            <h2 className="text-sm font-semibold text-zinc-700 mb-2">
              Friends ({friends.length})
            </h2>
            {friends.length ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {friends.map((friend) => (
                  <FriendRow key={friend.id} friend={friend} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">No friends yet.</p>
            )}
          </section>

          {/* Roles */}
          <section className="border border-zinc-200 rounded p-3">
            <h2 className="text-sm font-semibold text-zinc-700 mb-2">Roles</h2>
            {roleMutationError && (
              <p className="text-xs text-red-500 mb-2">{roleMutationError}</p>
            )}
            <div className="space-y-1">
              <label
                className={cn(
                  "flex items-center gap-2 text-sm cursor-pointer hover:bg-zinc-50 px-1 py-0.5 rounded",
                  isStaffPending && "opacity-50",
                )}
              >
                <input
                  type="checkbox"
                  checked={user.staff}
                  disabled={isStaffPending}
                  onChange={(e) => handleStaffToggle(e.target.checked)}
                  className="rounded"
                />
                <span
                  className={user.staff ? "text-zinc-900" : "text-zinc-500"}
                >
                  Staff
                </span>
              </label>
              <label
                className={cn(
                  "flex items-center gap-2 text-sm cursor-pointer hover:bg-zinc-50 px-1 py-0.5 rounded",
                  isAmbassadorPending && "opacity-50",
                )}
              >
                <input
                  type="checkbox"
                  checked={user.ambassador}
                  disabled={isAmbassadorPending}
                  onChange={(e) => handleAmbassadorToggle(e.target.checked)}
                  className="rounded"
                />
                <span
                  className={
                    user.ambassador ? "text-zinc-900" : "text-zinc-500"
                  }
                >
                  Ambassador
                </span>
              </label>
            </div>
          </section>

          {/* Tags */}
          <section className="border border-zinc-200 rounded p-3">
            <h2 className="text-sm font-semibold text-zinc-700 mb-2">
              Tags ({userTags.length})
            </h2>
            {tagMutationError && (
              <p className="text-xs text-red-500 mb-2">{tagMutationError}</p>
            )}
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {sortedAllTags.map((tag) => {
                const checked = userTagIds.has(tag.id);
                const pending = pendingTagOps.has(tagKey(tag.id));
                return (
                  <label
                    key={tag.id}
                    className={cn(
                      "flex items-center gap-2 text-sm cursor-pointer hover:bg-zinc-50 px-1 py-0.5 rounded",
                      pending && "opacity-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={pending}
                      onChange={(e) =>
                        handleTagToggle(tag.id, e.target.checked)
                      }
                      className="rounded"
                    />
                    <span
                      className={checked ? "text-zinc-900" : "text-zinc-500"}
                    >
                      {tag.name}
                    </span>
                  </label>
                );
              })}
              {sortedAllTags.length === 0 && (
                <p className="text-xs text-zinc-500">No tags available.</p>
              )}
            </div>
          </section>

          {/* Away Periods */}
          <section className="border border-zinc-200 rounded p-3">
            <h2 className="text-sm font-semibold text-zinc-700 mb-2">
              Away Periods ({sortedAwayRanges.length})
            </h2>
            {awayMutationError && (
              <p className="text-xs text-red-500 mb-2">{awayMutationError}</p>
            )}
            {sortedAwayRanges.length ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {sortedAwayRanges.map((range) => {
                  const status = awayRangeStatus(range);
                  return (
                    <div
                      key={range.id}
                      className={cn(
                        "text-xs p-2 rounded",
                        status === "current"
                          ? "bg-amber-50 border border-amber-200"
                          : status === "upcoming"
                            ? "bg-blue-50 border border-blue-200"
                            : "bg-zinc-50",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">
                          {formatAwayRange(range)}
                        </span>
                        <span
                          className={cn(
                            "text-xs",
                            status === "current"
                              ? "text-amber-700"
                              : status === "upcoming"
                                ? "text-blue-700"
                                : "text-zinc-400",
                          )}
                        >
                          {status}
                        </span>
                      </div>
                      {editingAwayRangeId === range.id ? (
                        <div className="mt-2 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <label className="text-xs text-zinc-600">
                              <span className="block mb-1">Start</span>
                              <FormInput
                                name="editAwayStartDate"
                                type="date"
                                value={editAwayStartDate}
                                onChange={(e) =>
                                  setEditAwayStartDate(e.target.value)
                                }
                              />
                            </label>
                            <label className="text-xs text-zinc-600">
                              <span className="block mb-1">End</span>
                              <FormInput
                                name="editAwayEndDate"
                                type="date"
                                value={editAwayEndDate}
                                min={editAwayStartDate}
                                onChange={(e) =>
                                  setEditAwayEndDate(e.target.value)
                                }
                              />
                            </label>
                          </div>
                          <AwayReasonSelect
                            value={editAwayReason}
                            onChange={setEditAwayReason}
                          />
                          <FormInput
                            name="editAwayNote"
                            type="text"
                            value={editAwayNote}
                            onChange={(e) => setEditAwayNote(e.target.value)}
                            placeholder={
                              editAwayReason === "other"
                                ? "Note required"
                                : "Note optional"
                            }
                          />
                          <div className="flex gap-2">
                            <Button
                              color={ButtonColor.Black}
                              size="small"
                              onClick={handleUpdateAwayRange}
                              disabled={
                                isAwayMutationPending ||
                                !editAwayStartDate ||
                                !editAwayEndDate ||
                                !editAwayReason ||
                                (editAwayReason === "other" &&
                                  !editAwayNote.trim())
                              }
                            >
                              Save
                            </Button>
                            <Button
                              color={ButtonColor.White}
                              size="small"
                              onClick={cancelAwayEdit}
                              disabled={isAwayMutationPending}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-zinc-600 mt-0.5">
                            {formatAwayReason(range.reason)}
                            {range.note && ` — ${range.note}`}
                          </p>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              className="p-1 text-zinc-500 hover:text-zinc-800 disabled:opacity-50"
                              onClick={() => startAwayEdit(range)}
                              disabled={isAwayMutationPending}
                              title="Edit away period"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="p-1 text-red-500 hover:text-red-700 disabled:opacity-50"
                              onClick={() => {
                                void handleDeleteAwayRange(range);
                              }}
                              disabled={isAwayMutationPending}
                              title="Delete away period"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">No away periods.</p>
            )}
            <div className="mt-3 pt-3 border-t border-zinc-200 space-y-2">
              <p className="text-xs font-semibold text-zinc-700">
                Schedule time away
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-zinc-600">
                  <span className="block mb-1">Start</span>
                  <FormInput
                    name="awayStartDate"
                    type="date"
                    value={awayStartDate}
                    min={todayDateInput()}
                    onChange={(e) => setAwayStartDate(e.target.value)}
                  />
                </label>
                <label className="text-xs text-zinc-600">
                  <span className="block mb-1">End</span>
                  <FormInput
                    name="awayEndDate"
                    type="date"
                    value={awayEndDate}
                    min={awayStartDate || todayDateInput()}
                    onChange={(e) => setAwayEndDate(e.target.value)}
                  />
                </label>
              </div>
              <AwayReasonSelect value={awayReason} onChange={setAwayReason} />
              <FormInput
                name="awayNote"
                type="text"
                value={awayNote}
                onChange={(e) => setAwayNote(e.target.value)}
                placeholder={
                  awayReason === "other" ? "Note required" : "Note optional"
                }
              />
              <Button
                color={ButtonColor.Black}
                size="small"
                onClick={handleCreateAwayRange}
                disabled={
                  isAwayMutationPending ||
                  !awayStartDate ||
                  !awayEndDate ||
                  !awayReason ||
                  (awayReason === "other" && !awayNote.trim())
                }
              >
                {isAwayMutationPending ? "Saving..." : "Schedule"}
              </Button>
            </div>
          </section>

          {/* Contract Details */}
          <section className="border border-zinc-200 rounded p-3">
            <div className="flex items-center justify-between mx-1">
              <h2 className="text-sm font-semibold text-zinc-700 mb-2">
                Contract
              </h2>
              <div className="text-sm mb-2">
                <span className={cn("font-medium", contractStatusColor)}>
                  {contractStatus}
                </span>
              </div>
            </div>
            {user.contractEvents && user.contractEvents.length > 0 ? (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {[...user.contractEvents]
                  .sort(
                    (a, b) =>
                      new Date(b.date).getTime() - new Date(a.date).getTime(),
                  )
                  .map((event, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "text-xs flex items-center justify-between px-2 py-1 rounded",
                        event.type === "signed"
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700",
                      )}
                    >
                      <span className="font-medium capitalize">
                        {event.type}
                      </span>
                      <span className="text-zinc-500">
                        {new Date(event.date).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">No contract events.</p>
            )}
          </section>

          {/* Form Submissions */}
          <section className="border border-zinc-200 rounded p-3">
            <h2 className="text-sm font-semibold text-zinc-700 mb-2">
              Invited Submissions ({sortedFormResponses.length})
            </h2>
            {sortedFormResponses.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {sortedFormResponses.map((response) => (
                  <div
                    key={response.id}
                    className="text-xs p-2 rounded bg-zinc-50 border border-zinc-100"
                  >
                    <div className="flex items-center justify-between">
                      <Link
                        to={`/forms/${response.formId}/responses`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        Form #{response.formId}
                      </Link>
                      <span className="text-zinc-400">
                        {new Date(response.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {response.deviceType && (
                      <p className="text-zinc-500 mt-0.5">
                        {response.deviceType}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">No form submissions.</p>
            )}
          </section>
        </div>
      </div>
      {isDeleteModalOpen && (
        <DeleteAccountModal
          userId={user.id}
          userName={user.name}
          userEmail={user.email}
          onCancel={() => setIsDeleteModalOpen(false)}
          onDeleted={() => {
            setIsDeleteModalOpen(false);
            success("Account deleted", user.name);
            navigate("/members");
          }}
        />
      )}
    </div>
  );
};

function MemberGroupMoveSection({
  user,
  communities,
  onUserUpdated,
  onCommunitiesUpdated,
}: {
  user: UserAdminDetailDto;
  communities: CommunityDto[];
  onUserUpdated: (user: UserAdminDetailDto) => void;
  onCommunitiesUpdated: (communities: CommunityDto[]) => void;
}) {
  const [sourceCommunityId, setSourceCommunityId] = useState("");
  const [destinationCommunityId, setDestinationCommunityId] = useState("");
  const [isMoving, setIsMoving] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const { confirm, success } = useToast();

  const userCommunities = useMemo(
    () => user.communities ?? [],
    [user.communities],
  );
  const leaderIdSet = useMemo(
    () => new Set(user.leaderOfIds ?? []),
    [user.leaderOfIds],
  );
  const memberCommunities = useMemo(
    () =>
      userCommunities
        .filter((community) => !leaderIdSet.has(community.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [leaderIdSet, userCommunities],
  );
  const leaderCommunities = useMemo(
    () =>
      userCommunities
        .filter((community) => leaderIdSet.has(community.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [leaderIdSet, userCommunities],
  );
  const currentCommunityIdSet = useMemo(
    () => new Set(userCommunities.map((community) => community.id)),
    [userCommunities],
  );
  const availableDestinations = useMemo(
    () =>
      communities
        .filter(
          (community) =>
            !currentCommunityIdSet.has(community.id) &&
            community.allowStaffAssignments &&
            community.maxCapacity !== null &&
            getMemberCount(community) < community.maxCapacity,
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [communities, currentCommunityIdSet],
  );

  useEffect(() => {
    setSourceCommunityId((current) => {
      if (
        current &&
        memberCommunities.some(
          (community) => community.id.toString() === current,
        )
      ) {
        return current;
      }
      return memberCommunities.length === 1
        ? memberCommunities[0].id.toString()
        : "";
    });
  }, [memberCommunities]);

  useEffect(() => {
    setDestinationCommunityId((current) =>
      availableDestinations.some(
        (community) => community.id.toString() === current,
      )
        ? current
        : "",
    );
  }, [availableDestinations]);

  const handleMove = useCallback(async () => {
    const sourceCommunity = memberCommunities.find(
      (community) => community.id.toString() === sourceCommunityId,
    );
    const destinationCommunity = availableDestinations.find(
      (community) => community.id.toString() === destinationCommunityId,
    );
    if (
      !destinationCommunity ||
      (memberCommunities.length && !sourceCommunity)
    ) {
      return;
    }

    const confirmed = await confirm({
      title: sourceCommunity ? "Move member?" : "Assign member to group?",
      message: sourceCommunity
        ? `Move ${user.name} from ${sourceCommunity.name} to ${destinationCommunity.name}?`
        : `Assign ${user.name} to ${destinationCommunity.name}?`,
      confirmLabel: sourceCommunity ? "Move member" : "Assign member",
      cancelLabel: "Cancel",
    });
    if (!confirmed) return;

    setIsMoving(true);
    setMutationError(null);
    let membershipUpdated = false;
    try {
      if (sourceCommunity) {
        await communityMoveMemberAdmin({
          path: { communityId: sourceCommunity.id },
          body: {
            userId: user.id,
            destinationCommunityId: destinationCommunity.id,
          },
          throwOnError: true,
        });
      } else {
        await communityAddMemberAdmin({
          path: { communityId: destinationCommunity.id },
          body: { userId: user.id },
          throwOnError: true,
        });
      }
      membershipUpdated = true;

      const [refreshedUser, refreshedCommunities] = await Promise.all([
        userUserDetailAdmin({
          path: { id: user.id },
          throwOnError: true,
        }),
        communityGetCommunitiesAdmin({ throwOnError: true }),
      ]);
      onUserUpdated(refreshedUser.data);
      onCommunitiesUpdated(refreshedCommunities.data);
      success(
        sourceCommunity ? "Member moved" : "Member assigned",
        destinationCommunity.name,
      );
    } catch (error) {
      if (membershipUpdated) {
        setMutationError(
          "Membership was updated, but the page could not refresh. Reload to see the latest group capacity.",
        );
      } else {
        setMutationError(
          errorMessage({
            error,
            fallback: sourceCommunity
              ? "Could not move this member."
              : "Could not assign this member.",
          }),
        );
      }
    } finally {
      setIsMoving(false);
    }
  }, [
    availableDestinations,
    confirm,
    destinationCommunityId,
    memberCommunities,
    onCommunitiesUpdated,
    onUserUpdated,
    sourceCommunityId,
    success,
    user.id,
    user.name,
  ]);

  const needsSourceSelection = memberCommunities.length > 0;
  const canSubmit =
    user.hasActiveContract &&
    destinationCommunityId !== "" &&
    (!needsSourceSelection || sourceCommunityId !== "") &&
    !isMoving;

  return (
    <section className="border border-zinc-200 rounded p-3">
      <h2 className="text-sm font-semibold text-zinc-700 mb-2">Groups</h2>
      <div className="space-y-3">
        <div className="space-y-1">
          {memberCommunities.map((community) => (
            <Link
              key={community.id}
              to={`/groups/${community.id}`}
              className="block text-sm text-blue-600 hover:underline"
            >
              {community.name}
            </Link>
          ))}
          {!memberCommunities.length && (
            <p className="text-xs text-zinc-500">No current member group.</p>
          )}
          {leaderCommunities.map((community) => (
            <div
              key={community.id}
              className="flex items-center gap-1.5 text-xs"
            >
              <Link
                to={`/groups/${community.id}`}
                className="text-blue-600 hover:underline"
              >
                {community.name}
              </Link>
              <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-500">
                Leader
              </span>
            </div>
          ))}
        </div>

        {needsSourceSelection && (
          <label className="block text-xs text-zinc-600">
            <span className="block mb-1">Move from</span>
            <select
              value={sourceCommunityId}
              onChange={(event) => setSourceCommunityId(event.target.value)}
              disabled={isMoving}
              className="w-full border border-zinc-300 rounded bg-white px-2 py-2 text-sm text-zinc-900"
            >
              <option value="">Select current group</option>
              {memberCommunities.map((community) => (
                <option key={community.id} value={community.id}>
                  {community.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block text-xs text-zinc-600">
          <span className="block mb-1">
            {needsSourceSelection ? "Move to" : "Assign to"}
          </span>
          <select
            value={destinationCommunityId}
            onChange={(event) => setDestinationCommunityId(event.target.value)}
            disabled={isMoving || !user.hasActiveContract}
            className="w-full border border-zinc-300 rounded bg-white px-2 py-2 text-sm text-zinc-900 disabled:bg-zinc-100"
          >
            <option value="">Select destination group</option>
            {availableDestinations.map((community) => (
              <option key={community.id} value={community.id}>
                {community.name}
              </option>
            ))}
          </select>
        </label>

        {!user.hasActiveContract && (
          <p className="text-xs text-amber-700">
            An active contract is required for group membership.
          </p>
        )}
        {user.hasActiveContract && !availableDestinations.length && (
          <p className="text-xs text-zinc-500">
            No groups with staff assignments and available capacity.
          </p>
        )}
        {leaderCommunities.length > 0 && (
          <p className="text-xs text-zinc-500">
            Moving a member does not change groups they lead.
          </p>
        )}
        {mutationError && (
          <p className="text-xs text-red-500" role="alert">
            {mutationError}
          </p>
        )}
        <Button
          color={ButtonColor.Black}
          size="small"
          onClick={() => void handleMove()}
          disabled={!canSubmit}
        >
          {isMoving
            ? needsSourceSelection
              ? "Moving..."
              : "Assigning..."
            : needsSourceSelection
              ? "Move member"
              : "Assign member"}
        </Button>
      </div>
    </section>
  );
}

function findTimeForUser(times: TimeSpentForUserDto[], userId: number) {
  return times.find((entry) => entry.userId === userId)?.timeSpent ?? 0;
}

function humanize(value?: string) {
  if (!value) {
    return undefined;
  }
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

type AwayRangeStatus = "current" | "upcoming" | "past";

function formatAwayDate(date: string) {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateForInput(date: string) {
  const parsed = new Date(date);
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayDateInput() {
  return formatDateForInput(new Date().toISOString());
}

function formatAwayRange(range: UserAwayRangeDto) {
  return `${formatAwayDate(range.startDate)} to ${formatAwayDate(
    range.endDate,
  )}`;
}

function formatAwayReason(reason: UserAwayRangeDto["reason"]) {
  return AWAY_REASON_LABELS[reason];
}

function awayRangeStatus(range: UserAwayRangeDto): AwayRangeStatus {
  const now = new Date();
  const start = new Date(range.startDate);
  const end = new Date(range.endDate);
  if (start <= now && now <= end) {
    return "current";
  }
  if (start > now) {
    return "upcoming";
  }
  return "past";
}

function notifTimestamp(notif: ActionEventNotifDto): number {
  const source = notif.mail ? notif.mail : notif.mms;
  const createdAt = source?.createdAt;
  return createdAt ? new Date(createdAt).getTime() : 0;
}

function keyForNotif(notif: ActionEventNotifDto) {
  const mailId = notif.mail?.id;
  const mmsId = notif.mms?.id;
  const pushId = notif.pushes?.[0]?.id;
  return `${notif.user.id}-${mailId ?? mmsId ?? pushId ?? Math.random()}`;
}

function AwayReasonSelect({
  value,
  onChange,
}: {
  value: UserAwayRangeReason | "";
  onChange: (value: UserAwayRangeReason | "") => void;
}) {
  return (
    <label className="text-xs text-zinc-600">
      <span className="block mb-1">Reason</span>
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value as UserAwayRangeReason | "")
        }
        className="w-full text-sm border border-gray-2 text-black bg-white px-2 rounded-sm py-2 focus:outline-none focus:border-black"
      >
        <option value="">Select a reason</option>
        {AWAY_REASON_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default UserDetailView;

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-zinc-400 mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="font-medium text-zinc-500">{label}</p>
        <div className="text-zinc-800 break-words">{children}</div>
      </div>
    </div>
  );
}

function DetailItem({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right text-zinc-800 break-words">{children}</dd>
    </div>
  );
}

function FriendRow({ friend }: { friend: ProfileDto }) {
  return (
    <Link
      to={`/member/${friend.id}`}
      className="flex items-center gap-2 rounded px-1 py-1.5 hover:bg-zinc-50"
    >
      <AvatarProfile pfp={friend.profilePicture} size="small" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-800">
          {friend.displayName}
        </p>
        <p className="truncate text-xs text-zinc-500">
          {formatFriendStatus(friend)}
        </p>
      </div>
    </Link>
  );
}

function formatFriendStatus(friend: ProfileDto) {
  const labels = [];
  if (friend.hasActiveContract) {
    labels.push("Signed");
  } else {
    labels.push("Not signed");
  }
  if (friend.ambassador) {
    labels.push("Ambassador");
  }
  if (friend.isCommunityLeader) {
    labels.push("Leader");
  }
  return labels.join(" · ");
}

function formatUserLocation(user: UserAdminDetailDto) {
  const parts = [
    user.location.cityName,
    user.location.countryName ?? user.location.countryCode,
  ].filter(Boolean);
  if (parts.length > 0) {
    return parts.join(", ");
  }
  return user.location.customCityString?.trim() || null;
}

function formatInvitedBy(user: UserAdminDetailDto) {
  const invitedBy = user.invitedBy;
  if (!invitedBy) {
    return "No invite attribution";
  }

  const source = formatInviteSource(invitedBy);
  const labelWithSource = `${invitedBy.label}${source}`;

  switch (invitedBy.kind) {
    case "user":
      return invitedBy.userId ? (
        <>
          <Link
            to={`/member/${invitedBy.userId}`}
            className="text-blue-600 hover:underline"
          >
            {invitedBy.label}
          </Link>
          {source}
        </>
      ) : (
        labelWithSource
      );
    case "campaign":
      return labelWithSource;
    case "unknown":
      return invitedBy.label;
    default:
      throw new Error(
        `unknown invited by kind: ${invitedBy.kind satisfies never}`,
      );
  }
}

function formatInviteSource(invitedBy: UserAdminInvitedByDto) {
  switch (invitedBy.referralSource) {
    case "onetime_invite":
      return " via individual single-use invite link";
    case "invite_share_link":
      return ` via group invite link${
        invitedBy.inviteLinkLabel ? ` “${invitedBy.inviteLinkLabel}”` : ""
      }`;
    case "referral_link":
    case "action_share_link":
    case "external_share_link":
    case "campaign":
    case "none":
      return ` via ${humanize(invitedBy.referralSource)}`;
    case undefined:
      return "";
    default:
      throw new Error(
        `unknown referral source: ${invitedBy.referralSource satisfies never}`,
      );
  }
}

function formatReminderTime(user: UserAdminDetailDto) {
  if (!user.preferredReminderTime) {
    return "Not provided";
  }
  return user.timeZone
    ? `${user.preferredReminderTime} ${user.timeZone}`
    : user.preferredReminderTime;
}
