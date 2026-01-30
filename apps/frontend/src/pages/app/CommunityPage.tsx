import {
  CommunityDto,
  UserActionRelationDetailDto,
  UserActionSummaryDto,
  userGetCommunityMemberContactInfo,
  actionsGetCommunityMemberInfo,
  userGetMyCommunities,
  userGetOnetimeInvitesByCommunity,
  CommunityMemberContactInfoDto,
  conversationGetCommunityConversations,
  userUpdateCommunity,
  userDeleteCommunity,
} from "@alliance/shared/client";
import {
  editGroupGroupAssignmentExplanation,
  editGroupPublicGroupExplanation,
} from "@alliance/shared/lib/copy";
import { useCallback, useEffect, useMemo, useState } from "react";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import CommunityMembersTable from "@alliance/sharedweb/ui/CommunityMembersTable";
import ProfileImage from "@alliance/sharedweb/ui/ProfileImage";
import ImageEditor from "../../components/ImageEditor";
import { useAuth } from "../../lib/AuthContext";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import { sharp_allowed_mime_types } from "@alliance/sharedweb/lib/config";
import CompletedBar from "../../components/CompletedBar";
import {
  GroupMemberGuidelines,
  GroupOrganizerGuidelines,
} from "../../components/GroupGuidelines";
import CommunityCreateForm from "../../components/CommunityCreateForm";
import { useSearchParams } from "react-router";
import CommunityActivityTab from "../../components/CommunityActivityTab";
import TwoColumnLayout from "../../components/TwoColumnLayout";
import FloatingChatPanel from "../../components/FloatingChatpanel";
import { MessageSquare } from "lucide-react";
import { Features } from "@alliance/shared/lib/features";
import { isFeatureEnabled } from "../../lib/config";
import CommunityInvitesLeaderTab from "../../components/CommunityInvitesLeaderTab";
import CommunityInvitesMemberTab from "../../components/CommunityInvitesMemberTab";
import BottomSpacer from "@alliance/sharedweb/ui/BottomSpacer";
import { useMediaQuery } from "../../lib/useMediaQuery";
import {
  calculateAllCompletionData,
  CompletionData,
} from "@alliance/shared/lib/actionUtils";
import { useMaxActionsPerWeek } from "@alliance/sharedweb/ui/UserProgressPills";
import useIncomingCommunityInvites from "@alliance/shared/lib/useIncomingCommunityInvites";
import NoCommunityPage from "./NoCommunityPage";
import CommunitySelectDropdown from "../../components/CommunitySelectDropdown";
import MyGroupsPage from "./MyGroupsPage";

export type Tab =
  | "activity"
  | "members"
  | "invites"
  | "about"
  | "resources"
  | "groups"
  | "create";

const TAB_DISPLAY_NAMES = {
  activity: "Activity",
  members: "Members",
  invites: "Invites",
  about: "About",
  resources: "Resources",
} satisfies Partial<Record<Tab, string>>;

const CURRENT_ACTION_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

const CommunityPage = () => {
  const [communities, setCommunities] = useState<CommunityDto[] | null>(null);
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

  const maxActionsPerWeek = useMaxActionsPerWeek({
    actionSummaries: actionSummaries,
    userActionRelations,
  });
  const [inviteNotifCount, setInviteNotifCount] = useState(0);
  const [allCompletionData, setAllCompletionData] = useState<ReturnType<
    typeof calculateAllCompletionData
  > | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [community, setCommunity] = useState<CommunityDto | null>(null);
  const { pendingCommunityInvites } = useIncomingCommunityInvites();

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editPublic, setEditPublic] = useState<boolean>(false);
  const [allowStaffAssignments, setAllowStaffAssignments] = useState(false);
  const [editMaxCapacity, setEditMaxCapacity] = useState<number | null>(null);
  const [editPhotoUrl, setEditPhotoUrl] = useState<string | null>(null);
  const [photoEditorKey, setPhotoEditorKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentPhoto = community?.photo ?? null;
  const isPhotoUploadPending = isSaving && editPhotoUrl !== currentPhoto;

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

  useEffect(() => {
    userGetMyCommunities().then((resp) => {
      if (resp.data) {
        resp.data.forEach(
          (community) =>
            (community.users = community.users.filter(
              (user) => user.hasActiveContract
            ))
        );
        setCommunities(resp.data);
        setCommunity(
          ((communityId !== null &&
            resp.data?.find(
              (community) => community.id.toString() === communityId
            )) ||
            resp.data?.[0]) ??
            null
        );
      }
    });
  }, [communityId]);

  // Initialize edit values when community changes and reset editing state
  useEffect(() => {
    if (community) {
      setEditName(community.name);
      setEditDescription(community.description);
      setEditPublic(community.public);
      setAllowStaffAssignments(
        community.public || community.maxCapacity !== null
      );
      setEditMaxCapacity(community.maxCapacity);
      setEditPhotoUrl(community.photo ?? null);
      setIsEditing(false);
      setError(null);
    }
  }, [community]);

  const messagingEnabled = useMemo(() => {
    return isFeatureEnabled(Features.Messaging);
  }, []);

  const amLeader = useMemo(() => {
    return community?.leaders.some((leader) => leader.id === user?.id);
  }, [community, user]);

  useEffect(() => {
    if (!community || !amLeader) {
      return;
    }
    (async () => {
      const invites = await userGetOnetimeInvitesByCommunity({
        path: { communityId: community.id },
      });
      if (!invites.data) {
        return;
      }
      setInviteNotifCount(
        invites.data.filter((invite) => invite.status === "request_pending")
          .length
      );
    })();
  }, [amLeader, community]);

  useEffect(() => {
    if (!community) {
      return;
    }
    actionsGetCommunityMemberInfo({
      path: {
        communityId: community.id,
      },
    }).then((resp) => {
      if (!resp.data) {
        return;
      }

      setUserActionRelations(
        Object.fromEntries(
          resp.data.users.map(({ userId, relations }) => [userId, relations])
        )
      );

      // Most recent actions first
      resp.data.actions.reverse();

      setActionSummaries(resp.data.actions);
      const completionData = calculateAllCompletionData({
        actions: resp.data.actions,
        users: resp.data.users,
        actionDeadlineWindowMs: CURRENT_ACTION_WINDOW_MS,
      });
      setAllCompletionData(completionData);
    });
  }, [community]);

  useEffect(() => {
    if (amLeader) {
      userGetCommunityMemberContactInfo().then((resp) => {
        if (resp.data) {
          setMemberContactInfo(
            resp.data.reduce((acc, contactInfo) => {
              acc[contactInfo.id] = contactInfo;
              return acc;
            }, {} as Record<number, CommunityMemberContactInfoDto>)
          );
        }
      });
    }
  }, [amLeader]);

  const setParams = useCallback(
    (params: { tab?: Tab | null; communityId?: number | null }) => {
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
    },
    [setSearchParams]
  );

  const onRemoveMember = useCallback((memberId: number) => {
    setCommunity((prev) => {
      if (!prev) {
        return null;
      }
      return {
        ...prev,
        users: prev.users.filter((member) => member.id !== memberId),
      };
    });
  }, []);

  const requiresMaxCapacity = useMemo(
    () => editPublic || allowStaffAssignments,
    [editPublic, allowStaffAssignments]
  );

  const handleSave = useCallback(async () => {
    if (!community || isSaving) return;

    // Validation
    if (!editName.trim()) {
      setError("Name is required");
      return;
    }

    const normalizedMaxCapacity =
      allowStaffAssignments || editPublic ? editMaxCapacity : null;
    if (requiresMaxCapacity) {
      if (!normalizedMaxCapacity || normalizedMaxCapacity <= 0) {
        setError("Capacity is required");
        return;
      }
    }

    setIsSaving(true);
    setError(null);
    try {
      const response = await userUpdateCommunity({
        path: { communityId: community.id },
        body: {
          name: editName,
          description: editDescription,
          photo: editPhotoUrl ?? undefined,
          public: editPublic,
          maxCapacity: normalizedMaxCapacity,
        },
      });

      if (response.data) {
        setCommunity(response.data);
        setIsEditing(false);
        // Refresh communities list
        userGetMyCommunities().then((resp) => {
          if (resp.data) {
            resp.data.forEach(
              (community) =>
                (community.users = community.users.filter(
                  (user) => user.hasActiveContract
                ))
            );
            setCommunities(resp.data);
          }
        });
      } else {
        setError("Failed to update community");
      }
    } catch (err) {
      console.error("Failed to update community:", err);
      setError("Failed to update community");
    } finally {
      setIsSaving(false);
    }
  }, [
    community,
    editName,
    editDescription,
    editPublic,
    allowStaffAssignments,
    editMaxCapacity,
    editPhotoUrl,
    requiresMaxCapacity,
    isSaving,
  ]);

  const handleCancel = useCallback(() => {
    if (community) {
      setEditName(community.name);
      setEditDescription(community.description);
      setEditPublic(community.public);
      setAllowStaffAssignments(
        community.public || community.maxCapacity !== null
      );
      setEditMaxCapacity(community.maxCapacity);
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
      const response = await userDeleteCommunity({
        path: { communityId: community.id },
      });
      if (response.data) {
        setCommunities((prev) => {
          const next = prev?.filter((c) => c.id !== community.id) ?? null;
          if (!next?.length) {
            refreshUser();
          }
          return next;
        });
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
  }, [community, isSaving, refreshUser, setParams]);

  const tabs: (keyof typeof TAB_DISPLAY_NAMES)[] = amLeader
    ? ["activity", "members", "invites", "resources"]
    : ["activity", "members", "invites", "about"];

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

  if (!community) {
    return <NoCommunityPage />;
  }

  const leaders = community.leaders;
  const nonLeaderMembers = community.users.filter(
    (user) => !leaders.some((leader) => leader.id === user.id)
  );
  const canDelete = (amLeader && community.users.length === 1) ?? false;

  return (
    <TwoColumnLayout
      main={
        <div className="xl:p-10 xl:pr-5 max-w-[900px] mx-auto p-3 md:p-5">
          {tab !== "groups" && (
            <>
              <div className="flex flex-col gap-y-2 my-8">
                <div className="flex flex-row mb-4 justify-between">
                  {isEditing ? (
                    <ImageEditor
                      key={photoEditorKey}
                      initialImageUrl={editPhotoUrl}
                      onChange={setEditPhotoUrl}
                      allowedMimeTypes={sharp_allowed_mime_types}
                      isUploading={isPhotoUploadPending}
                    />
                  ) : (
                    <ProfileImage pfp={community.photo ?? null} size="huge" />
                  )}
                  <div className="flex flex-row gap-x-1">
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
                    {amLeader && (
                      <>
                        {isEditing ? (
                          <div className="flex flex-row gap-x-1 items-start">
                            {canDelete && (
                              <Button
                                color={ButtonColor.Red}
                                onClick={handleDelete}
                                disabled={isSaving}
                                className="!text-sm"
                              >
                                Delete
                              </Button>
                            )}
                            <Button
                              color={ButtonColor.Light}
                              onClick={handleCancel}
                              disabled={isSaving}
                              className="!text-sm"
                            >
                              Cancel
                            </Button>
                            <Button
                              color={ButtonColor.Blue}
                              onClick={handleSave}
                              disabled={isSaving}
                              className="!text-sm"
                            >
                              {isSaving ? "Saving..." : "Save"}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            color={ButtonColor.White}
                            onClick={() => setIsEditing(true)}
                            className="!text-sm"
                          >
                            Edit
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-y-4 mb-8">
                  {isEditing ? (
                    <div className="flex flex-col gap-y-4">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="font-serif font-semibold text-3xl md:text-4xl border-none !bg-zinc-100 px-2 -mx-2 rounded focus:outline-none w-full"
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
                                  setAllowStaffAssignments(true);
                                }
                              }}
                              className="mt-1"
                            />
                            <div>
                              <p className="text-base font-medium">
                                Public group
                              </p>
                              <p className="text-sm text-zinc-500 font-normal">
                                {editGroupPublicGroupExplanation}
                              </p>
                            </div>
                          </label>
                          <label
                            className="flex items-start gap-x-2 text-black text-sm font-semibold"
                            htmlFor="allowAssignments"
                          >
                            <input
                              id="allowAssignments"
                              type="checkbox"
                              checked={allowStaffAssignments}
                              onChange={(e) =>
                                setAllowStaffAssignments(e.target.checked)
                              }
                              disabled={editPublic}
                              className="mt-1"
                            />
                            <div>
                              <p className="text-base font-medium">
                                Accept member assignments
                              </p>
                              <p className="text-sm text-zinc-500 font-normal">
                                {editGroupGroupAssignmentExplanation}
                              </p>
                            </div>
                          </label>
                        </div>
                        {requiresMaxCapacity && (
                          <div className="mt-4">
                            <label
                              className="text-black font-medium"
                              htmlFor="maxCapacity"
                            >
                              <p className="text-base font-medium">
                                Member capacity
                              </p>
                              <p className="text-sm text-zinc-500 font-normal">
                                The maximum number of members that can join this
                                group.
                              </p>
                            </label>
                            <input
                              id="maxCapacity"
                              type="number"
                              min={1}
                              value={editMaxCapacity ?? ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                const parsed = Number(value);
                                setEditMaxCapacity(
                                  value === "" || Number.isNaN(parsed)
                                    ? null
                                    : parsed
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
                      <p className="font-serif font-semibold text-3xl md:text-4xl">
                        {community.name}
                      </p>
                      <AppMarkdownWrapper
                        markdownContent={community.description}
                      />
                    </>
                  )}
                </div>

                <div
                  className={`max-w-[400px] ${
                    completionData.nTotal === 0 ? " invisible" : ""
                  }`}
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
              </div>
              <div className="flex flex-row gap-x-2 justify-start mb-4 border-b border-zinc-200">
                {tabs.map((m) => (
                  <Button
                    color={ButtonColor.Transparent}
                    key={m}
                    onClick={() => setParams({ tab: m })}
                    aria-pressed={m === tab}
                    className={`!border-b-[1.5px] rounded-none ${
                      m === tab ? "!border-b-green" : "!border-b-transparent"
                    }`}
                  >
                    <div className="flex flex-row gap-x-2">
                      <span>{TAB_DISPLAY_NAMES[m]}</span>
                      {m === "invites" && inviteNotifCount > 0 && (
                        <span className="font-semibold text-xs text-white bg-zinc-500 rounded-md flex justify-center items-center w-5 h-5">
                          {inviteNotifCount}
                        </span>
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            </>
          )}

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
              onRemoveMember={onRemoveMember}
              amLeader={amLeader ?? false}
              memberContactInfo={memberContactInfo ?? undefined}
              userActionRelations={userActionRelations ?? undefined}
              actions={actionSummaries}
              maxActionsPerWeek={maxActionsPerWeek}
              completedAllCurrentActions={
                completionData.completedAllCurrentActions
              }
            />
          )}
          {tab === "about" && (
            <div className="flex flex-col gap-y-4 py-4">
              <GroupMemberGuidelines />
            </div>
          )}
          {tab === "resources" && (
            <div className="flex flex-col gap-y-4 py-4">
              <GroupOrganizerGuidelines />
            </div>
          )}
          {tab === "invites" &&
            (amLeader ? (
              <CommunityInvitesLeaderTab
                communityId={community.id}
                existingMembers={community.users}
                setInviteNotifCount={setInviteNotifCount}
              />
            ) : (
              <CommunityInvitesMemberTab communityId={community.id} />
            ))}
          {tab === "groups" && (
            <div className="flex flex-col gap-y-6">
              <MyGroupsPage
                onSelectCommunity={(communityId) => {
                  setParams({ communityId, tab: "activity" });
                  if (communityId === null) {
                    refreshUser();
                  }
                }}
                onBack={() => setParams({ tab: null })}
                communities={communities}
                isOnboardingGroupMember={
                  user?.isIntroductoryGroupMember ?? true
                }
              />
            </div>
          )}
          {tab === "create" && (
            <CommunityCreateForm
              name={user?.name}
              onCancel={() => setParams({ tab: "groups" })}
              onSuccess={(community) => {
                setCommunity(community);
                setParams({ communityId: community.id, tab: "groups" });
              }}
            />
          )}
          <BottomSpacer />
          {!chatOpen && messagingEnabled && isLargeScreen && (
            <div className="absolute bottom-5 right-7 bg-white hover:bg-zinc-100">
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
      }
      sidebar={
        messagingEnabled && isLargeScreen ? (
          <div
            className="p-10 h-screen px-5 transition-all duration-200 ease-in-out"
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
