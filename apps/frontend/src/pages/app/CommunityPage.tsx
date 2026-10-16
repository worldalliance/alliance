import { getMemberCount } from "@alliance/common/community";
import {
  calculateAllCompletionData,
  CompletionData,
} from "@alliance/shared/lib/actionUtils";
import { isLedBy } from "@alliance/shared/lib/communityUtils";
import { Features } from "@alliance/shared/lib/features";
import { useCommunityCompletedActionsCount } from "@alliance/shared/lib/useCommunityCompletedActionsCount";
import { useCommunityConversation } from "@alliance/shared/lib/useCommunityConversation";
import { useCommunityMemberContactInfo } from "@alliance/shared/lib/useCommunityMemberContactInfo";
import { useCommunityMemberInfo } from "@alliance/shared/lib/useCommunityMemberInfo";
import { useIncomingCommunityInvites } from "@alliance/shared/lib/useIncomingCommunityInvites";
import { useMyCommunities } from "@alliance/shared/lib/useMyCommunities";
import { cn } from "@alliance/shared/styles/util";
import { useMediaQuery } from "@alliance/sharedweb/lib/useMediaQuery";
import BottomSpacer from "@alliance/sharedweb/ui/BottomSpacer";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import CommunityMembersTable from "@alliance/sharedweb/ui/CommunityMembersTable";
import CompletedBar from "@alliance/sharedweb/ui/CompletedBar";
import { useMaxActionsPerWeek } from "@alliance/sharedweb/ui/UserProgressPills";
import { milliseconds } from "date-fns";
import { MessageSquare } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { href, Link, useSearchParams } from "react-router";
import CommunityActivityTab from "../../components/CommunityActivityTab";
import CommunityInvitesLeaderTab from "../../components/CommunityInvitesLeaderTab";
import CommunityProfile from "../../components/CommunityProfile";
import CommunitySelectDropdown from "../../components/CommunitySelectDropdown";
import FloatingChatPanel from "../../components/FloatingChatpanel";
import PillTab from "../../components/PillTab";
import TwoColumnLayout from "../../components/TwoColumnLayout";
import { useAuth } from "../../lib/AuthContext";
import { isFeatureEnabled } from "../../lib/config";
import { useCommunityEditor } from "../../lib/useCommunityEditor";
import { WalkthroughAnchor } from "../../onboarding/walkthrough/steps";
import MyGroupsPage from "./MyGroupsPage";
import PageSpinner from "./PageSpinner";

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

const CURRENT_ACTION_WINDOW_MS = milliseconds({ days: 3 });

const CommunityPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = (searchParams.get("tab") as Tab | undefined) ?? "activity";
  const communityId = searchParams.get("communityId");
  const {
    communities,
    communityIds,
    isLoading: areGroupsLoading,
    didFail: didGroupsFail,
    refreshCommunities,
    removeCommunity,
    selectedCommunity: community,
    removeMemberFromCommunity,
    updateCommunity,
  } = useMyCommunities({
    selectedCommunityId: communityId ? Number(communityId) : null,
  });

  const [chatOpen, setChatOpen] = useState(false);
  const { pendingCommunityInvites } = useIncomingCommunityInvites();
  const memberCount = community ? getMemberCount(community) : 0;

  const { conversation: communityConversation } = useCommunityConversation(
    community?.id ?? null,
  );
  // Decide once per group, so a later update can't reopen a closed chat.
  const chatAutoOpenedForRef = useRef<number | null>(null);
  useEffect(() => {
    if (
      !community ||
      !communityConversation ||
      chatAutoOpenedForRef.current === community.id
    ) {
      return;
    }
    chatAutoOpenedForRef.current = community.id;
    if (communityConversation.lastMessage) {
      setChatOpen(true);
    }
  }, [community, communityConversation]);

  const { user, refreshUser } = useAuth();

  const messagingEnabled = useMemo(() => {
    return isFeatureEnabled(Features.Messaging);
  }, []);

  const amLeader = useMemo(() => {
    return community && isLedBy(community, user?.id);
  }, [community, user]);

  const { data: communityMemberInfo } = useCommunityMemberInfo({
    communityId: community?.id,
    userId: user?.id,
  });

  const { data: memberContactInfo } = useCommunityMemberContactInfo({
    communityId: community?.id,
    amLeader: amLeader ?? false,
  });

  const { data: communityCompletedActionsCount = 0 } =
    useCommunityCompletedActionsCount({
      communityId: community?.id,
      actions: communityMemberInfo?.actions,
    });

  const userActionRelations = useMemo(
    () =>
      communityMemberInfo
        ? Object.fromEntries(
            communityMemberInfo.users.map(({ userId, relations }) => [
              userId,
              relations,
            ]),
          )
        : null,
    [communityMemberInfo],
  );

  const actionSummaries = useMemo(
    () =>
      communityMemberInfo ? [...communityMemberInfo.actions].reverse() : [],
    [communityMemberInfo],
  );

  const allCompletionData = useMemo(
    () =>
      communityMemberInfo
        ? calculateAllCompletionData({
            actions: communityMemberInfo.actions,
            users: communityMemberInfo.users,
            actionDeadlineWindowMs: CURRENT_ACTION_WINDOW_MS,
          })
        : null,
    [communityMemberInfo],
  );

  const maxActionsPerWeek = useMaxActionsPerWeek({
    actionSummaries,
    userActionRelations,
  });

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

  const handleDeleted = useCallback(
    (deletedId: number) => {
      removeCommunity(deletedId);
      setParams({ communityId: null, tab: null });
    },
    [removeCommunity, setParams],
  );

  const editor = useCommunityEditor({
    community,
    memberCount,
    onUpdated: updateCommunity,
    onDeleted: handleDeleted,
  });

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

  if (areGroupsLoading && !didGroupsFail) {
    return <PageSpinner />;
  }

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
    (user) => !isLedBy(community, user.id),
  );

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
              <Card
                className="relative z-0 px-4 md:px-8 pb-6 gap-y-2"
                data-walkthrough={WalkthroughAnchor.Group}
              >
                <CommunityProfile
                  community={community}
                  amLeader={amLeader ?? false}
                  memberCount={memberCount}
                  editor={editor}
                />

                <div
                  className={cn(
                    "max-w-[400px] mt-2",
                    completionData.nTotal === 0 && "invisible",
                  )}
                >
                  <p className="text-sm">
                    {completionData.nCompleted} / {completionData.nTotal} are
                    caught up on {actionDisplay}
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
                      <PillTab
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
                  memberHref={(id) =>
                    href("/member/:id", { id: id.toString() })
                  }
                  onRemoveMember={(memberId) =>
                    removeMemberFromCommunity(community.id, memberId)
                  }
                  amLeader={amLeader ?? false}
                  memberContactInfo={memberContactInfo}
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
                  title="Open Chat"
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
