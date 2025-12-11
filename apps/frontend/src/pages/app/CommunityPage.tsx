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
} from "@alliance/shared/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Spinner from "../../components/Spinner";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import CommunityMemberTableRow from "../../components/CommunityMemberTableRow";
import { useAuth } from "../../lib/AuthContext";
import AppMarkdownWrapper from "@alliance/shared/ui/AppMarkdownWrapper";
import CompletedBar from "../../components/CompletedBar";
import DropdownSelect from "@alliance/shared/ui/DropdownSelect";
import {
  GroupMemberGuidelines,
  GroupOrganizerGuidelines,
} from "../../components/GroupGuidelines";
import CommunityEditForm from "../../components/CommunityEditForm";
import { href, useNavigate, useSearchParams } from "react-router";
import { useToast } from "@alliance/shared/ui/ToastProvider";
import CommunityActivityTab from "../../components/CommunityActivityTab";
import { parseTimeInput } from "@alliance/shared/forms/timeUtils";
import TwoColumnLayout from "../../components/TwoColumnLayout";
import FloatingChatPanel from "../../components/FloatingChatpanel";
import { MessageSquare } from "lucide-react";
import { Features } from "@alliance/shared/lib/features";
import { isFeatureEnabled } from "../../lib/config";
import CommunityInvitesTabLeader from "../../components/CommunityInvitesTabLeader";
import CommunityInvitesTabMember from "../../components/CommunityInvitesTabMember";
import BottomSpacer from "@alliance/shared/ui/BottomSpacer";

type Tab = "activity" | "members" | "invites" | "about" | "edit" | "resources";

export enum FilterMode {
  All = "All members",
  Completed = "Completed",
  NotYetCompleted = "Not yet completed",
}

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
  const [inviteNotifCount, setInviteNotifCount] = useState(0);

  const [chatOpen, setChatOpen] = useState(true);

  const [completedAllCurrentActions, setCompletedAllCurrentActions] = useState<
    Record<number, boolean>
  >({});

  const nCompleted = useMemo(() => {
    if (!community?.users || !userActionRelations) {
      return 0;
    }

    const completedall: Record<number, boolean> = {};
    for (const member of community.users) {
      completedall[member.id] = true;
    }

    for (const action of activeActions) {
      for (const member of community?.users ?? []) {
        const relation = userActionRelations?.[member.id]?.find(
          (relation) => relation.actionId === action.id
        );
        if (relation?.status !== "completed") {
          completedall[member.id] = false;
        }
      }
    }
    setCompletedAllCurrentActions(completedall);
    return Object.values(completedall).filter((completed) => completed).length;
  }, [activeActions, community, userActionRelations]);

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
        // Most recent actions first
        resp.data.actions.reverse();

        setActionSummaries(resp.data.actions);
        setActiveActions(
          resp.data.actions.filter(
            (action) => action.status === "member_action"
          )
        );
        setUserActionRelations(
          resp.data.users.reduce((acc, user) => {
            acc[user.userId] = user.relations;
            return acc;
          }, {} as Record<number, UserActionRelationDetailDto[]>)
        );
      }
    });
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

  const [filterMode, setFilterMode] = useState<FilterMode>(FilterMode.All);

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

  const membersByFilterMode = {
    [FilterMode.All]: nonLeaderMembers,
    [FilterMode.NotYetCompleted]: nonLeaderMembers.filter(
      (user) => !completedAllCurrentActions[user.id]
    ),
    [FilterMode.Completed]: nonLeaderMembers.filter(
      (user) => completedAllCurrentActions[user.id]
    ),
  };
  const filteredSortedMembers = membersByFilterMode[filterMode].sort((a, b) => {
    // if leader, sort by preferred contact time in leader's time zone

    if (amLeader) {
      const preferredTimeA =
        memberContactInfo?.[a.id]?.preferredReminderTimeLeaderTz ?? "";
      const preferredTimeB =
        memberContactInfo?.[b.id]?.preferredReminderTimeLeaderTz ?? "";

      const timeA = parseTimeInput(preferredTimeA);
      const timeB = parseTimeInput(preferredTimeB);

      if (timeA && timeB) {
        return timeA.minutes - timeB.minutes;
      }

      if (!timeA && timeB) {
        return -1;
      }
      if (timeA && !timeB) {
        return 1;
      }
    }
    return 0;
  });

  const isChatOpen = messagingEnabled && chatOpen;

  return (
    <TwoColumnLayout
      main={
        <div className="p-5 xl:p-10 max-w-[900px] mx-auto">
          <div className="flex flex-col gap-y-2 my-8">
            <div className="flex flex-row gap-x-2 items-start justify-between">
              <div className="flex flex-col gap-y-4 mb-8">
                <p className="font-serif font-semibold text-3xl md:text-4xl">
                  {community.name}
                </p>
                <AppMarkdownWrapper markdownContent={community.description} />
              </div>

              {amLeader ? (
                <Button
                  color={ButtonColor.Light}
                  onClick={() => setTab("edit")}
                >
                  Edit
                </Button>
              ) : (
                <Button color={ButtonColor.White} onClick={handleLeave}>
                  Leave group
                </Button>
              )}
            </div>

            <div className="w-1/2">
              <p className="text-sm">
                {nCompleted} / {community.users.length} have completed current
                action
                {activeActions.length !== 1 ? "s" : ""}
              </p>
              <CompletedBar
                percentage={(nCompleted / community.users.length) * 100}
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
                    <div className="font-semibold text-xs text-white bg-zinc-500 rounded-full rounded-md flex justify-center items-center w-5 h-5">
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
            <div className="flex flex-col py-4">
              <div className="">
                <table className="w-full border-collapse">
                  <thead className="text-left bg-white">
                    <tr>
                      <td colSpan={3} className="px-0 pb-6">
                        <p className="text-xl md:text-2xl font-semibold">
                          Lead{leaders.length !== 1 ? "s" : ""}
                        </p>
                      </td>
                    </tr>
                  </thead>
                  <thead className="text-left bg-zinc-50">
                    <tr className="*:py-4 *:px-2 *:md:px-4 border border-zinc-200 text-xs md:text-sm text-zinc-600">
                      <th scope="col" className="font-medium">
                        Name
                      </th>
                      <th scope="col" className="font-medium">
                        Action history
                      </th>
                      {amLeader && (
                        <th
                          scope="col"
                          className="font-medium md:whitespace-nowrap"
                        >
                          Preferred contact time
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="border border-zinc-200">
                    {leaders.map((user) => (
                      <CommunityMemberTableRow
                        key={user.id}
                        profile={user}
                        canExpand={amLeader}
                        amLeader={amLeader}
                        contactInfo={memberContactInfo?.[user.id]}
                        actionRelations={userActionRelations?.[user.id] ?? []}
                        actions={actionSummaries}
                      />
                    ))}
                  </tbody>
                  <thead className="text-left bg-white">
                    <tr>
                      <td
                        colSpan={3}
                        className="px-0 pt-10 pb-6 border-y border-zinc-200"
                      >
                        <div className="flex flex-col gap-y-2">
                          <p className="text-xl md:text-2xl font-semibold">
                            Members
                          </p>
                          <p className="text-zinc-500 text-sm">
                            Sort by completion of current actions
                          </p>
                          <DropdownSelect
                            options={Object.values(FilterMode)}
                            secondaryLabels={Object.values(FilterMode).map(
                              (mode) =>
                                membersByFilterMode[mode].length.toString()
                            )}
                            value={filterMode}
                            onChange={(mode) =>
                              setFilterMode(mode as FilterMode)
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  </thead>
                  <thead className="text-left bg-zinc-50">
                    <tr className="*:py-4 *:px-2 *:md:px-4 border border-zinc-200 text-xs md:text-sm text-zinc-600">
                      <th scope="col" className="font-medium">
                        Name
                      </th>
                      <th scope="col" className="font-medium">
                        Action history
                      </th>
                      {amLeader && (
                        <th
                          scope="col"
                          className="font-medium md:whitespace-nowrap"
                        >
                          Preferred contact time
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="border border-zinc-200">
                    {filteredSortedMembers.map((user) => (
                      <CommunityMemberTableRow
                        key={user.id}
                        profile={user}
                        canExpand={amLeader}
                        amLeader={amLeader}
                        contactInfo={memberContactInfo?.[user.id]}
                        actionRelations={userActionRelations?.[user.id] ?? []}
                        actions={actionSummaries}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
          {!chatOpen && messagingEnabled && (
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
        messagingEnabled ? (
          <div
            className="p-5 xl:p-10 h-screen xl:px-5 transition-all duration-200 ease-in-out"
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
      sidebarWidth={isChatOpen ? 500 : 0}
    />
  );
};

export default CommunityPage;
