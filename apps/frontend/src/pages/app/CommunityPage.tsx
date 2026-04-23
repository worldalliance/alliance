import {
  actionsCommunityCompletedActionsCount,
  actionsGetCommunityMemberInfo,
  communityDelete,
  communityGetMemberContactInfo,
  CommunityMemberContactInfoDto,
  communityUpdate,
  conversationGetCommunityConversations,
  UserActionRelationDetailDto,
  UserActionSummaryDto,
} from "@alliance/shared/client";
import { groupSettings } from "@alliance/shared/lib/copy";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@alliance/shared/styles/util";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import CommunityMembersTable from "@alliance/sharedweb/ui/CommunityMembersTable";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import ImageEditor from "../../components/ImageEditor";
import { useAuth } from "../../lib/AuthContext";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import { sharp_allowed_mime_types } from "@alliance/sharedweb/lib/config";
import CompletedBar from "@alliance/sharedweb/ui/CompletedBar";
import { useSearchParams } from "react-router";
import CommunityActivityTab from "../../components/CommunityActivityTab";
import TwoColumnLayout from "../../components/TwoColumnLayout";
import FloatingChatPanel from "../../components/FloatingChatpanel";
import { MessageSquare } from "lucide-react";
import { Features } from "@alliance/shared/lib/features";
import { isFeatureEnabled } from "../../lib/config";
import BottomSpacer from "@alliance/sharedweb/ui/BottomSpacer";
import { useMediaQuery } from "../../lib/useMediaQuery";
import {
  calculateAllCompletionData,
  CompletionData,
} from "@alliance/shared/lib/actionUtils";
import { useMaxActionsPerWeek } from "@alliance/sharedweb/ui/UserProgressPills";
import useIncomingCommunityInvites from "@alliance/shared/lib/useIncomingCommunityInvites";
import CommunitySelectDropdown from "../../components/CommunitySelectDropdown";
import MyGroupsPage from "./MyGroupsPage";
import { Link } from "react-router";
import { getMemberCount } from "@alliance/shared/lib/communityUtils";
import { useMyCommunities } from "../../lib/useMyCommunities";
import CommunityInvitesLeaderTab from "../../components/CommunityInvitesLeaderTab";
import UserProfileTab from "../../components/UserProfileTab";

export type Tab = "activity" | "members" | "groups" | "invites";

const TAB_DISPLAY_NAMES = {
  activity: "Activity",
  members: "Members",
  invites: "Invites",
} satisfies Partial<Record<Tab, string>>;

const SHOWN_TABS = {
  leader: ["activity", "members", "invites"],
  member: ["activity", "members"],
} as const satisfies Record<
  "leader" | "member",
  (keyof typeof TAB_DISPLAY_NAMES)[]
>;

const CURRENT_ACTION_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

const CommunityPage = () => {
  const [memberContactInfo, setMemberContactInfo] = useState<Record<
    number,
    CommunityMemberContactInfoDto
  > | null>(null);
  const [userActionRelations, setUserActionRelations] = useState<Record<
    number,
    UserActionRelationDetailDto[]
  > | null>(null);

  const [actionSummaries, setActionSummaries] = useState<
    UserActionSummaryDto[]
  >([]);

  const [searchParams, setSearchParams] = useSearchParams();

  const tab = (searchParams.get("tab") as Tab | undefined) ?? "activity";
  const communityId = searchParams.get("communityId");
  const {
    communities,
    communityIds,
    refreshCommunities,
    removeCommunity,
    selectedCommunity: community,
    removeMemberFromCommunity,
    updateSelectedCommunity,
  } = useMyCommunities({
    selectedCommunityId: communityId ? Number(communityId) : null,
  });

  const maxActionsPerWeek = useMaxActionsPerWeek({
    actionSummaries: actionSummaries,
    userActionRelations,
  });
  const [allCompletionData, setAllCompletionData] = useState<ReturnType<
    typeof calculateAllCompletionData
  > | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const { pendingCommunityInvites } = useIncomingCommunityInvites();
  const memberCount = community ? getMemberCount(community) : 0;

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editPublic, setEditPublic] = useState<boolean>(false);
  const [editAllowMemberInvites, setEditAllowMemberInvites] =
    useState<boolean>(true);
  const [editAllowStaffAssignments, setEditAllowStaffAssignments] =
    useState<boolean>(true);
  const [editMaxCapacity, setEditMaxCapacity] = useState<number | null>(null);
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | null>(null);
  const [photoEditorKey, setPhotoEditorKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentPhoto = community?.photo ?? null;
  const isPhotoUploadPending = isSaving && editPhotoUrl !== currentPhoto;
  const useMaxCapacity =
    editPublic || editAllowMemberInvites || editAllowStaffAssignments;

  useEffect(() => {
    if (!community?.id) {
      return;
    }
    conversationGetCommunityConversations({
      path: { communityId: community.id },
    }).then((response) => {
      if (response.data?.lastMessage) {
        setChatOpen(true);
      }
    });
  }, [community?.id]);

  const { user, refreshUser } = useAuth();

  // Initialize edit values when community changes and reset editing state
  useEffect(() => {
    if (community) {
      setEditName(community.name);
      setEditDescription(community.description);
      setEditPublic(community.public);
      setEditAllowMemberInvites(community.allowMemberInvites ?? true);
      setEditAllowStaffAssignments(community.allowStaffAssignments ?? true);
      setEditMaxCapacity(
        community.maxCapacity === null
          ? null
          : Math.max(community.maxCapacity, memberCount),
      );
      setEditPhotoUrl(community.photo ?? null);
      setIsEditing(false);
      setError(null);
    }
  }, [community, memberCount]);

  const messagingEnabled = useMemo(() => {
    return isFeatureEnabled(Features.Messaging);
  }, []);

  const amLeader = useMemo(() => {
    return community?.leaders.some((leader) => leader.id === user?.id);
  }, [community, user]);

  const { data: communityMemberInfo } = useQuery({
    queryKey: ["communityMemberInfo", community?.id ?? null, user?.id ?? null],
    queryFn: () =>
      community
        ? actionsGetCommunityMemberInfo({
            path: {
              communityId: community.id,
            },
          }).then((resp) => resp.data)
        : null,
    enabled: !!community,
  });

  const { data: communityCompletedActionsCount = 0 } = useQuery({
    queryKey: ["communityCompletedActionsCount", community?.id ?? null],
    queryFn: () =>
      community
        ? actionsCommunityCompletedActionsCount({
            query: { communityId: community.id },
          }).then((resp) => resp.data?.completedCount ?? 0)
        : 0,
    enabled: !!community,
  });

  const queryClient = useQueryClient();

  useEffect(() => {
    if (!communityMemberInfo?.actions?.length || community?.id == null) {
      return;
    }

    const now = Date.now();
    const futureDeadlines = communityMemberInfo.actions
      .map((a) => a.memberActionDeadline)
      .filter((d): d is number => d != null && d > now);

    if (futureDeadlines.length === 0) return;

    const soonestDeadline = Math.min(...futureDeadlines);
    const delayMs = soonestDeadline - now;

    const timeoutId = window.setTimeout(() => {
      void queryClient.invalidateQueries({
        queryKey: ["communityMemberInfo", community.id, user?.id ?? null],
      });
      void queryClient.invalidateQueries({
        queryKey: ["communityCompletedActionsCount", community.id],
      });
    }, delayMs);

    return () => window.clearTimeout(timeoutId);
  }, [communityMemberInfo?.actions, community?.id, user?.id, queryClient]);

  useEffect(() => {
    if (!communityMemberInfo) {
      return;
    }

    setUserActionRelations(
      Object.fromEntries(
        communityMemberInfo.users.map(({ userId, relations }) => [
          userId,
          relations,
        ]),
      ),
    );

    const reversedActions = [...communityMemberInfo.actions].reverse();

    setActionSummaries(reversedActions);
    const completionData = calculateAllCompletionData({
      actions: communityMemberInfo.actions,
      users: communityMemberInfo.users,
      actionDeadlineWindowMs: CURRENT_ACTION_WINDOW_MS,
    });
    setAllCompletionData(completionData);
  }, [communityMemberInfo]);

  useEffect(() => {
    if (amLeader && community?.id !== undefined) {
      communityGetMemberContactInfo({
        path: {
          communityId: community.id,
        },
      }).then((resp) => {
        if (resp.data) {
          setMemberContactInfo(
            resp.data.reduce(
              (acc, contactInfo) => {
                acc[contactInfo.id] = contactInfo;
                return acc;
              },
              {} as Record<number, CommunityMemberContactInfoDto>,
            ),
          );
        }
      });
    }
  }, [amLeader, community?.id]);

  const setParams = useCallback(
    (params: { tab?: Tab | null; communityId?: number | null }) => {
      void (async () => {
        if (
          typeof params.communityId === "number" &&
          !communityIds.has(params.communityId)
        ) {
          await refreshCommunities();
        }
        setSearchParams((prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(params)) {
            if (value === null || value === undefined) {
              next.delete(key);
            } else {
              next.set(key, value.toString());
            }
          }
          return next;
        });
      })();
    },
    [setSearchParams, communityIds, refreshCommunities],
  );

  const handleSave = useCallback(async () => {
    setError(null);
    if (!community || isSaving) return;

    // Validation
    if (!editName.trim()) {
      setError("Name is required");
      return;
    }

    let normalizedMaxCapacity: number | null = null;
    if (useMaxCapacity) {
      if (!editMaxCapacity || editMaxCapacity <= 0) {
        setError("Capacity is required");
        return;
      }
      normalizedMaxCapacity = editMaxCapacity;
    }
    if (normalizedMaxCapacity !== null && normalizedMaxCapacity < memberCount) {
      setError(
        `Capacity cannot be less than the current number of members (${memberCount})`,
      );
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const response = await communityUpdate({
        path: { communityId: community.id },
        body: {
          name: editName,
          description: editDescription,
          photo: editPhotoUrl ?? undefined,
          public: editPublic,
          maxCapacity: normalizedMaxCapacity,
          allowMemberInvites: editAllowMemberInvites,
          allowStaffAssignments: editAllowStaffAssignments,
        },
      });

      if (response.data) {
        updateSelectedCommunity(response.data);
        setIsEditing(false);
      } else {
        setError("Failed to update group");
      }
    } catch (err) {
      console.error("Failed to update group:", err);
      setError("Failed to update group");
    } finally {
      setIsSaving(false);
    }
  }, [
    community,
    editName,
    editDescription,
    editPublic,
    editAllowMemberInvites,
    editAllowStaffAssignments,
    editMaxCapacity,
    editPhotoUrl,
    isSaving,
    useMaxCapacity,
    memberCount,
    updateSelectedCommunity,
  ]);

  const handleCancel = useCallback(() => {
    if (community) {
      setEditName(community.name);
      setEditDescription(community.description);
      setEditPublic(community.public);
      setEditAllowStaffAssignments(community.allowStaffAssignments ?? true);
      setEditAllowMemberInvites(community.allowMemberInvites ?? true);
      setEditMaxCapacity(
        community.maxCapacity === null
          ? null
          : Math.max(
              community.maxCapacity,
              community.users.length - community.leaders.length,
            ),
      );
      setEditPhotoUrl(community.photo ?? null);
    }
    setPhotoEditorKey((prev) => prev + 1);
    setError(null);
    setIsEditing(false);
  }, [community]);

  const handleDelete = useCallback(async () => {
    if (!community || isSaving) return;

    setIsSaving(true);
    setError(null);
    try {
      const response = await communityDelete({
        path: { communityId: community.id },
      });
      if (response.data) {
        removeCommunity(community.id);
        setParams({ communityId: null, tab: null });
      } else {
        setError("Failed to delete community");
      }
    } catch (err) {
      console.error("Failed to delete community:", err);
      setError("Failed to delete community");
    } finally {
      setIsSaving(false);
    }
  }, [community, isSaving, removeCommunity, setParams]);

  const tabs = SHOWN_TABS[amLeader ? "leader" : "member"];

  const isLargeScreen = useMediaQuery("(min-width: 1250px)");
  const isChatOpen = messagingEnabled && chatOpen;

  const completionData = useMemo<CompletionData>(() => {
    if (!allCompletionData) {
      return {
        completedAllCurrentActions: {},
        nCompleted: 0,
        nTotal: 0,
        nActions: 0,
      };
    }
    return allCompletionData.previous ?? allCompletionData.current;
  }, [allCompletionData]);
  const actionDisplay = useMemo(() => {
    if (!allCompletionData) {
      return "current actions";
    }

    if (allCompletionData.previous) {
      return allCompletionData.previous.nActions === 1
        ? "the previous action"
        : "previous actions";
    }

    return allCompletionData.current.nActions !== 1
      ? "current actions"
      : "the current action";
  }, [allCompletionData]);

  const groupManagementPage = (
    <MyGroupsPage
      onSelectCommunity={(communityId) => {
        setParams({ communityId, tab: "activity" });
        if (communityId === null) {
          refreshUser();
        }
      }}
      onBack={() => setParams({ tab: null })}
    />
  );

  if (!community) {
    return (
      <div className="p-5 xl:p-10 xl:pr-5 max-w-[900px] mx-auto px-0 md:px-3">
        <div className="flex flex-col gap-y-2 my-8 px-5 md:px-0">
          <div className="flex flex-col sm:flex-row justify-between gap-2">
            <h1 className="text-title">Manage groups</h1>
            <Link
              to={"/groups-guide"}
              className="text-zinc-500 hover:text-black py-2"
            >
              About groups
            </Link>
          </div>
          {groupManagementPage}
        </div>
      </div>
    );
  }

  const leaders = community.leaders;
  const nonLeaderMembers = community.users.filter(
    (user) => !leaders.some((leader) => leader.id === user.id),
  );
  const canDelete = (amLeader && community.users.length === 1) ?? false;

  return (
    <TwoColumnLayout
      main={
        <div className="relative xl:p-10 xl:pr-5 max-w-[900px] mx-auto p-0 md:p-5">
          <div className="p-3 relative z-10 flex flex-col md:flex-row items-end md:items-center md:justify-end gap-x-4">
            <Link
              to={"/groups-guide"}
              className="shrink-0 text-sm md:text-base text-zinc-500 hover:text-black py-1"
            >
              About groups
            </Link>
            <CommunitySelectDropdown
              communities={communities}
              currentCommunityId={community.id}
              onSelectCommunity={(communityId) => {
                setParams({ communityId, tab: "activity" });
              }}
              onManageGroups={() => setParams({ tab: "groups" })}
              titleOverride={"My groups"}
              notifCount={pendingCommunityInvites.length}
            />
          </div>
          <div className="mx-2 space-y-2 mt-8">
            {tab !== "groups" && (
              <Card className="relative z-0 px-4 md:px-8 pb-6 gap-y-2">
                {isEditing ? (
                  <ImageEditor
                    key={photoEditorKey}
                    className="mt-[-55px]"
                    initialImageUrl={editPhotoUrl}
                    onChange={setEditPhotoUrl}
                    allowedMimeTypes={sharp_allowed_mime_types}
                    isUploading={isPhotoUploadPending}
                  />
                ) : (
                  <AvatarProfile
                    pfp={community.photo ?? null}
                    size="huge"
                    className="mt-[-55px]"
                  />
                )}
                <div className="absolute right-0 top-0 z-10 flex flex-row flex-wrap items-start justify-end gap-2 p-5">
                  {amLeader && (
                    <>
                      {isEditing ? (
                        <div className="flex flex-row flex-wrap justify-end gap-x-1 gap-y-1">
                          {canDelete && (
                            <Button
                              color={ButtonColor.Red}
                              onClick={handleDelete}
                              disabled={isSaving}
                            >
                              Delete
                            </Button>
                          )}
                          <Button
                            color={ButtonColor.Light}
                            onClick={handleCancel}
                            disabled={isSaving}
                          >
                            Cancel
                          </Button>
                          <Button
                            color={ButtonColor.Blue}
                            onClick={handleSave}
                            disabled={isSaving || !editName.trim()}
                          >
                            {isSaving ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          color={ButtonColor.White}
                          onClick={() => setIsEditing(true)}
                        >
                          Edit
                        </Button>
                      )}
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-y-4 mb-2 mt-3">
                  {isEditing ? (
                    <div className="flex flex-col gap-y-4">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="text-title-small w-full border-none !bg-zinc-100 px-2 -mx-2 rounded focus:outline-none"
                        placeholder="Enter group name"
                      />
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={6}
                        className="w-full border-none !bg-zinc-100 px-2 -mx-2 rounded focus:outline-none p-2"
                        placeholder="Enter group description..."
                      />
                      <div className="mt-3 rounded border border-zinc-200 bg-zinc-50 p-3">
                        <div className="flex flex-col gap-y-3">
                          <label
                            className="flex items-start gap-x-2 text-black text-sm font-semibold"
                            htmlFor="public"
                          >
                            <input
                              id="public"
                              type="checkbox"
                              checked={editPublic}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setEditPublic(checked);
                                if (checked) {
                                  setEditAllowMemberInvites(true);
                                  setEditAllowStaffAssignments(true);
                                }
                              }}
                              className="mt-1"
                            />
                            <div>
                              <p className="text-base font-medium">
                                {groupSettings.public.name}
                              </p>
                              <p className="text-sm text-zinc-500 font-normal">
                                {groupSettings.public.explanation}
                              </p>
                            </div>
                          </label>
                          <label
                            className="flex items-start gap-x-2 text-black text-sm font-semibold"
                            htmlFor="allowMemberInvites"
                          >
                            <input
                              id="allowMemberInvites"
                              type="checkbox"
                              checked={editAllowMemberInvites}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setEditAllowMemberInvites(checked);
                              }}
                              disabled={editPublic}
                              className="mt-1"
                            />
                            <div>
                              <p className="text-base font-medium">
                                {groupSettings.allowMemberInvites.name}
                              </p>
                              <p className="text-sm text-zinc-500 font-normal">
                                {groupSettings.allowMemberInvites.explanation}
                              </p>
                            </div>
                          </label>
                          <label
                            className="flex items-start gap-x-2 text-black text-sm font-semibold"
                            htmlFor="allowStaffAssignments"
                          >
                            <input
                              id="allowStaffAssignments"
                              type="checkbox"
                              checked={editAllowStaffAssignments}
                              onChange={(e) =>
                                setEditAllowStaffAssignments(e.target.checked)
                              }
                              disabled={editPublic}
                              className="mt-1"
                            />
                            <div>
                              <p className="text-base font-medium">
                                {groupSettings.allowStaffAssignments.name}
                              </p>
                              <p className="text-sm text-zinc-500 font-normal">
                                {
                                  groupSettings.allowStaffAssignments
                                    .explanation
                                }
                              </p>
                            </div>
                          </label>
                        </div>
                        {useMaxCapacity && (
                          <div className="mt-4">
                            <label
                              className="text-black font-medium"
                              htmlFor="maxCapacity"
                            >
                              <p className="text-base font-medium">
                                {groupSettings.maxCapacity.name}
                                {` (${memberCount} members)`}
                              </p>
                              <p className="text-sm text-zinc-500 font-normal">
                                {groupSettings.maxCapacity.explanation}
                              </p>
                            </label>
                            <input
                              id="maxCapacity"
                              type="number"
                              min={Math.max(memberCount, 1)}
                              value={editMaxCapacity ?? ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                const parsed = Number(value);
                                setEditMaxCapacity(
                                  value === "" || Number.isNaN(parsed)
                                    ? null
                                    : parsed,
                                );
                              }}
                              className="mt-2 border border-zinc-300 rounded px-3 py-2 w-full bg-white"
                            />
                          </div>
                        )}
                      </div>
                      {error && (
                        <p className="text-red-500 text-sm mt-1">{error}</p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <h1 className="text-title-small">{community.name}</h1>
                      </div>
                      <AppMarkdownWrapper
                        markdownContent={community.description}
                        className="mb-2 text-base"
                      />
                    </>
                  )}
                </div>

                <div
                  className={cn(
                    "max-w-[400px] mt-2",
                    completionData.nTotal === 0 && "invisible",
                  )}
                >
                  <p className="text-sm">
                    {completionData.nCompleted} / {completionData.nTotal} have
                    completed {actionDisplay}
                  </p>
                  <CompletedBar
                    percentage={
                      completionData.nTotal === 0
                        ? 100
                        : (completionData.nCompleted / completionData.nTotal) *
                          100
                    }
                    height="h-4"
                    dark
                  />
                </div>
                <div className="mt-4 flex flex-row flex-wrap items-center justify-between gap-x-2 gap-y-2 transition-none">
                  <div className="flex flex-row flex-wrap gap-2">
                    {tabs.map((m) => (
                      <UserProfileTab
                        key={m}
                        number={
                          m === "activity"
                            ? communityCompletedActionsCount
                            : m === "members"
                              ? memberCount
                              : undefined
                        }
                        label={
                          m === "activity"
                            ? communityCompletedActionsCount === 1
                              ? "action completed"
                              : "actions completed"
                            : m === "members"
                              ? memberCount === 1
                                ? "member"
                                : "members"
                              : TAB_DISPLAY_NAMES[m]
                        }
                        shortLabel={
                          m === "activity"
                            ? "actions"
                            : m === "members"
                              ? "members"
                              : TAB_DISPLAY_NAMES[m]
                        }
                        selected={tab === m}
                        onClick={() => setParams({ tab: m })}
                      />
                    ))}
                  </div>
                </div>
              </Card>
            )}

            <div className="pb-24 mt-2">
              {tab === "activity" && (
                <CommunityActivityTab
                  communityId={community.id}
                  userId={user?.id}
                />
              )}
              {tab === "members" && (
                <CommunityMembersTable
                  leaders={leaders}
                  members={nonLeaderMembers}
                  communityId={community.id}
                  onRemoveMember={(memberId) =>
                    removeMemberFromCommunity(community.id, memberId)
                  }
                  amLeader={amLeader ?? false}
                  memberContactInfo={memberContactInfo ?? undefined}
                  userActionRelations={userActionRelations ?? undefined}
                  actions={actionSummaries}
                  maxActionsPerWeek={maxActionsPerWeek}
                  completedAllCurrentActions={
                    completionData.completedAllCurrentActions
                  }
                  showInfoTooltip
                />
              )}
              {tab === "groups" && groupManagementPage}
              {tab === "invites" && (
                <CommunityInvitesLeaderTab
                  communityId={community.id}
                  existingMembers={community.users}
                  setInviteNotifCount={() => {}}
                />
              )}
              <BottomSpacer />
            </div>
            {!chatOpen && messagingEnabled && isLargeScreen && (
              <div className="fixed bottom-5 right-7 z-10 bg-white hover:bg-zinc-100">
                <Button
                  color={ButtonColor.Outline}
                  onClick={() => setChatOpen(true)}
                  className="!px-3 !py-3"
                >
                  <MessageSquare size="20" />
                </Button>
              </div>
            )}
          </div>
        </div>
      }
      sidebar={
        messagingEnabled && isLargeScreen ? (
          <div
            className="p-10 h-full px-5 transition-all duration-200 ease-in-out min-h-0 flex flex-col"
            style={{
              transform: chatOpen ? "translateY(0)" : "translateY(100%)",
            }}
          >
            <Card className="h-full !p-0">
              <FloatingChatPanel
                communityId={community.id}
                onClose={() => setChatOpen(false)}
              />
            </Card>
          </div>
        ) : null
      }
      sidebarWidth={isChatOpen && isLargeScreen ? 500 : 0}
      noSidebarOverflow
    />
  );
};

export default CommunityPage;
