import {
  actionsActionRelationsForUserAdmin,
  analyticsGetTimeSpentPerUserAdmin,
  analyticsGetTimeSpentPerUserTotalAdmin,
  notifsNotifsForUserAdmin,
  tasksGetFormsForUserSidAdmin,
  userAddUserToTagAdmin,
  userGetAwayRangeForUserAdmin,
  userGetTagSummariesAdmin,
  userRemoveUserFromTagAdmin,
  userUpdateUserRolesAdmin,
  userUserDetailAdmin,
} from "@alliance/shared/client";
import {
  ActionEventNotifDto,
  Push,
  TagDto,
  TagSummaryDto,
  TimeSpentForUserDto,
  UserActionRelationDetailDto,
  UserActionRelationsResponseDto,
  UserActionSummaryDto,
  UserAwayRangeDto,
  UserDto,
} from "@alliance/shared/client/types.gen";
import { cn } from "@alliance/shared/styles/util";
import { getApiUrl } from "@alliance/sharedweb/lib/config";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@alliance/sharedweb/ui/HoverCard";
import DatabaseIcon from "@alliance/sharedweb/ui/icons/DatabaseIcon";
import { PILL_STATUS_DATA } from "@alliance/sharedweb/ui/UserProgressPills";
import { ChevronDown, ChevronRight, Database, Mail, Phone } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLoaderData, useNavigate } from "react-router";
import { Route } from "../../.react-router/types/src/pages/+types/UserDetailView";
import CreateActivityControls from "../components/CreateActivityControls";

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
  } = loaderData;

  const [user, setUser] = useState<UserDto>(loaderData.user);
  const [actionRelationsState, setActionRelationsState] =
    useState<UserActionRelationDetailDto[]>(actionRelations);
  const [allTags, setAllTags] = useState<TagSummaryDto[]>(loaderData.allTags);
  const [pendingTagOps, setPendingTagOps] = useState<Set<string>>(
    () => new Set(),
  );
  const [tagMutationError, setTagMutationError] = useState<string | null>(null);
  const [isAmbassadorPending, setIsAmbassadorPending] = useState(false);
  const [roleMutationError, setRoleMutationError] = useState<string | null>(
    null,
  );
  const [expandedEmailId, setExpandedEmailId] = useState<number | null>(null);

  useEffect(() => {
    setUser(loaderData.user);
  }, [loaderData.user]);

  useEffect(() => {
    setActionRelationsState(actionRelations);
  }, [actionRelations]);

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

  const relationByActionId = useMemo(() => {
    return actionRelationsState.reduce(
      (acc, relation) => {
        acc[relation.actionId] = relation;
        return acc;
      },
      {} as Record<number, UserActionRelationDetailDto>,
    );
  }, [actionRelationsState]);

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
    return [...awayRanges].sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    );
  }, [awayRanges]);

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
    ? user.contractEvents.sort(
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
            <Link
              to={`/database/?table=user&id=${user.id}`}
              className="text-zinc-400 hover:text-zinc-600"
            >
              <DatabaseIcon size="large" />
            </Link>
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
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-600 mt-3">
            <span>
              <Mail size={16} className="text-zinc-500 inline mr-1" />
              {user.email}
            </span>
            {user.phoneNumber && (
              <span className="text-zinc-400">
                <Phone size={16} className="text-zinc-500 inline mr-1" />
                {user.phoneNumber}
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
                          <Link
                            to={`/database/?table=mms&id=${mms?.id}`}
                            target="_blank"
                            className="p-1 shrink-0 pr-3 text-zinc-600 hover:text-black"
                          >
                            <Database size={12} />
                          </Link>
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
                          <Link
                            to={`/database/?table=push&id=${push.id}`}
                            target="_blank"
                            className="p-1 shrink-0 pr-3 text-zinc-600 hover:text-black"
                          >
                            <Database size={12} />
                          </Link>
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
                      <p className="text-zinc-600 mt-0.5">
                        {formatAwayReason(range.reason)}
                        {range.note && ` — ${range.note}`}
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-zinc-500">No away periods.</p>
            )}
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
    </div>
  );
};

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

function formatAwayRange(range: UserAwayRangeDto) {
  return `${formatAwayDate(range.startDate)} to ${formatAwayDate(
    range.endDate,
  )}`;
}

function formatAwayReason(reason: UserAwayRangeDto["reason"]) {
  return humanize(reason) ?? reason;
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

export default UserDetailView;
