import {
  CommunityDto,
  UserActionRelationDetailDto,
  UserActionSummaryDto,
  userGetCommunityMemberContactInfo,
  actionsGetCommunityMemberInfo,
  userGetMyCommunity,
  userLeaveCommunity,
  userGetOnetimeInvitesByCommunity,
  CommunityMemberContactInfoDto,
  conversationGetCommunityConversations,
  ActionSuiteSummaryDto,
} from "@alliance/shared/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import CommunityMembersTable from "@alliance/sharedweb/ui/CommunityMembersTable";
import { useAuth } from "../../lib/AuthContext";
import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import CompletedBar from "../../components/CompletedBar";
import {
  GroupMemberGuidelines,
  GroupOrganizerGuidelines,
} from "../../components/GroupGuidelines";
import CommunityEditForm from "../../components/CommunityEditForm";
import { href, useNavigate, useSearchParams } from "react-router";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import CommunityActivityTab from "../../components/CommunityActivityTab";
import TwoColumnLayout from "../../components/TwoColumnLayout";
import FloatingChatPanel from "../../components/FloatingChatpanel";
import { MessageSquare } from "lucide-react";
import { Features } from "@alliance/shared/lib/features";
import { isFeatureEnabled } from "../../lib/config";
import CommunityInvitesTabLeader from "../../components/CommunityInvitesTabLeader";
import CommunityInvitesTabMember from "../../components/CommunityInvitesTabMember";
import BottomSpacer from "@alliance/sharedweb/ui/BottomSpacer";
import { useMediaQuery } from "../../lib/useMediaQuery";
import DropdownSelect from "@alliance/sharedweb/ui/DropdownSelect";
import { CardStyle } from "@alliance/shared/styles/card";
import { calculateCompletionData } from "@alliance/shared/lib/actionUtils";
import { useMaxActionsPerWeek } from "@alliance/sharedweb/ui/UserProgressPills";

type Tab = "activity" | "members" | "invites" | "about" | "edit" | "resources";

const CommunityPage = () => {
  const [community, setCommunity] = useState<CommunityDto | null>(null);
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

  const tab = searchParams.get("tab") ?? "activity";

  const [activeActions, setActiveActions] = useState<UserActionSummaryDto[]>(
    []
  );
  const maxActionsPerWeek = useMaxActionsPerWeek({
    actionSummaries: actionSummaries,
    userActionRelations,
  });
  const [inviteNotifCount, setInviteNotifCount] = useState(0);
  const [activeActionSuites, setActiveActionSuites] = useState<
    ActionSuiteSummaryDto[] | null
  >(null);
  const [selectedSuite, setSelectedSuite] = useState<string | null>(null);
  const [currentActionsSelected, setCurrentActionsSelected] = useState(true);

  const [chatOpen, setChatOpen] = useState(false);

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

  const selectedActions = useMemo(() => {
    if (selectedSuite === null || activeActionSuites === null) {
      return activeActions;
    }

    const suite = activeActionSuites?.find(
      (suite) => suite.name === selectedSuite
    );
    if (suite === undefined) {
      return activeActions;
    }

    return activeActions.filter((action) => action.suiteId === suite.id);
  }, [activeActions, activeActionSuites, selectedSuite]);

  const { completedAllCurrentActions, nCompleted, nTotal } = useMemo<{
    completedAllCurrentActions: Record<number, boolean>;
    nCompleted: number;
    nTotal: number;
  }>(() => {
    if (!community?.users || !userActionRelations) {
      return {
        completedAllCurrentActions: {} as Record<number, boolean>,
        nCompleted: 0,
        nTotal: 0,
      };
    }

    return calculateCompletionData({
      filteredActionIds: selectedActions.map((a) => a.id),
      userActionRelations,
    });
  }, [selectedActions, community, userActionRelations]);

  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    userGetMyCommunity().then((resp) => {
      if (resp.data) {
        resp.data.users = resp.data.users.filter(
          (user) => user.hasActiveContract
        );
        setCommunity(resp.data);
      }
      setLoading(false);
    });
  }, []);

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
    actionsGetCommunityMemberInfo().then((resp) => {
      if (resp.data) {
        setUserActionRelations(
          resp.data.users.reduce((acc, user) => {
            acc[user.userId] = user.relations;
            return acc;
          }, {} as Record<number, UserActionRelationDetailDto[]>)
        );

        // Most recent actions first
        resp.data.actions.reverse();

        setActionSummaries(resp.data.actions);
        const actionsWithSuites = resp.data.actions.filter(
          (action): action is typeof action & { suiteId: number } =>
            action.suiteId !== undefined && action.allMembersParticipating
        );
        if (actionsWithSuites.length === 0) {
          return;
        }
        const activeActions = actionsWithSuites.filter(
          (action) => action.status === "member_action"
        );

        if (activeActions.length === 0) {
          const lastSuiteId =
            actionsWithSuites[actionsWithSuites.length - 1].suiteId;
          const lastSuite = resp.data.suites.find(
            (suite) => suite.id === lastSuiteId
          )!;
          setActiveActionSuites([lastSuite]);
          setActiveActions(
            actionsWithSuites.filter((action) => action.suiteId === lastSuiteId)
          );
          setSelectedSuite(lastSuite.name);
          setCurrentActionsSelected(false);
          return;
        }

        const activeSuiteIds = new Set(activeActions.map((a) => a.suiteId));
        const activeSuites = resp.data.suites.filter((suite) =>
          activeSuiteIds.has(suite.id)
        );
        setActiveActionSuites(activeSuites);
        setActiveActions(activeActions);
        setSelectedSuite(activeSuites[0].name);
        setCurrentActionsSelected(true);
      }
    });
  }, []);

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
  const suiteDropdownOptions = useMemo(() => {
    if (!activeActionSuites || activeActionSuites.length <= 1) {
      return null;
    }

    return Object.fromEntries(
      activeActionSuites.map((suite) => [suite.id, suite.name])
    );
  }, [activeActionSuites]);

  const setTab = useCallback(
    (tab: Tab) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", tab);
        return next;
      });
    },
    [setSearchParams]
  );

  const navigate = useNavigate();

  const { confirm } = useToast();

  const handleLeave = useCallback(async () => {
    if (!community) {
      return;
    }
    const ok = await confirm({
      title: "Leave group",
      message:
        "Are you sure you want to leave this group? You will not be able to rejoin unless you are invited again.",
      confirmLabel: "Leave",
      cancelLabel: "Cancel",
    });
    if (!ok) {
      return;
    }

    userLeaveCommunity({ path: { communityId: community.id } }).then((resp) => {
      if (resp.response.ok) {
        navigate(href("/tasks"));
      }
    });
  }, [community, navigate, confirm]);

  const tabs: Tab[] = amLeader
    ? ["activity", "members", "invites", "resources"]
    : ["activity", "members", "invites", "about"];

  const isLargeScreen = useMediaQuery("(min-width: 1250px)");
  const isChatOpen = messagingEnabled && chatOpen;

  const actionDisplay = useMemo(() => {
    if (selectedActions.length === 1) {
      if (currentActionsSelected) {
        return "the current action";
      }
      return "the previous action";
    }
    if (currentActionsSelected) {
      return "current actions";
    }
    return "the previous actions";
  }, [selectedActions.length, currentActionsSelected]);

  if (!community) {
    if (loading) {
      return <Spinner />;
    }
    return (
      <div className="flex justify-center items-center h-[calc(100vh-var(--nav-height))]">
        <p className="text-zinc-500 pb-20">
          You are not a member of a group yet.
        </p>
      </div>
    );
  }

  const leaders = community.leaders;
  const nonLeaderMembers = community.users.filter(
    (user) => !leaders.some((leader) => leader.id === user.id)
  );

  return (
    <TwoColumnLayout
      main={
        <div className="p-5 xl:p-10 xl:pr-5 max-w-[900px] mx-auto px-0 md:px-3">
          <div className="flex flex-col gap-y-2 my-8 px-5 md:px-0">
            <div className="flex flex-row gap-x-2 items-start justify-between">
              <div className="flex flex-col gap-y-4 mb-8">
                <p className="font-serif font-semibold text-3xl md:text-4xl">
                  {community.name}
                </p>
                <AppMarkdownWrapper markdownContent={community.description} />
              </div>

              {amLeader ? (
                <Button
                  color={ButtonColor.White}
                  onClick={() => setTab("edit")}
                  className="!text-sm"
                >
                  Edit
                </Button>
              ) : (
                <Button
                  color={ButtonColor.White}
                  onClick={handleLeave}
                  className="!text-sm"
                >
                  Leave group
                </Button>
              )}
            </div>

            <div className={`max-w-[400px]${nTotal === 0 ? " invisible" : ""}`}>
              {amLeader && suiteDropdownOptions && selectedSuite && (
                <>
                  <DropdownSelect
                    options={suiteDropdownOptions}
                    value={selectedSuite}
                    onChange={(_, suiteId) => setSelectedSuite(suiteId)}
                  ></DropdownSelect>
                  <br />
                </>
              )}
              <p className="text-sm">
                {nCompleted} / {nTotal} have completed {actionDisplay}
              </p>
              <CompletedBar
                percentage={nTotal === 0 ? 0 : (nCompleted / nTotal) * 100}
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
                onClick={() => setTab(m)}
                aria-pressed={m === tab}
                className={`!border-b-[1.5px] rounded-none ${
                  m === tab ? "!border-b-green" : "!border-b-transparent"
                }`}
              >
                <div className="flex flex-row gap-x-2">
                  <span className="capitalize">{m}</span>
                  {m === "invites" && inviteNotifCount > 0 && (
                    <div className="font-semibold text-xs text-white bg-zinc-500 rounded-md flex justify-center items-center w-5 h-5">
                      {inviteNotifCount}
                    </div>
                  )}
                </div>
              </Button>
            ))}
          </div>
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
              amLeader={amLeader ?? false}
              memberContactInfo={memberContactInfo ?? undefined}
              userActionRelations={userActionRelations ?? undefined}
              actions={actionSummaries}
              maxActionsPerWeek={maxActionsPerWeek}
              completedAllCurrentActions={completedAllCurrentActions}
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
              <CommunityInvitesTabLeader
                communityId={community.id}
                existingMembers={community.users}
                setInviteNotifCount={setInviteNotifCount}
              />
            ) : (
              <CommunityInvitesTabMember communityId={community.id} />
            ))}
          {tab === "edit" && (
            <Card style={CardStyle.Grey}>
              <CommunityEditForm
                initialValue={community}
                onCancel={() => setTab("members")}
                onSuccess={() => {
                  window.location.reload();
                }}
              />
            </Card>
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
