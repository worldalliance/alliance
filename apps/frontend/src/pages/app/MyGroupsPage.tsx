import {
  CommunityDto,
  userGetPublicCommunities,
  userJoinGroupAssignment,
  userJoinPublicCommunity,
  userLeaveCommunity,
  userLeaveGroupAssignment,
} from "@alliance/shared/client";
import List from "@alliance/sharedweb/ui/List";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import ProfileImage from "@alliance/sharedweb/ui/ProfileImage";
import { ChevronLeft, Minus, Plus } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import useIncomingCommunityInvites from "@alliance/shared/lib/useIncomingCommunityInvites";
import {
  leaveGroupConfirmation,
  requestGroupAssignmentConfirmation,
} from "@alliance/shared/lib/copy";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { useAuth } from "../../lib/AuthContext";
import CommunityInviteList from "../../components/CommunityInviteList";
import CommunityCreateForm from "../../components/CommunityCreateForm";

export type MyGroupsPageProps = {
  communities: CommunityDto[] | null;
  onSelectCommunity: (communityId: number | null | undefined) => void;
  onBack?: () => void;
  isOnboardingGroupMember: boolean;
};

const MyGroupsPage = ({
  communities,
  onSelectCommunity,
  onBack,
  isOnboardingGroupMember,
}: MyGroupsPageProps) => {
  const { user, refreshUser } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { confirm, error: showError, success } = useToast();
  const {
    pendingCommunityInvites,
    incomingCommunityInvitesById,
    acceptCommunityInvite,
    declineCommunityInvite,
  } = useIncomingCommunityInvites();

  const handleDeclineInvite = useCallback(
    (inviteId: number) => {
      void declineCommunityInvite(inviteId);
    },
    [declineCommunityInvite]
  );

  const { leaderCommunities, nonLeaderCommunities } = useMemo(() => {
    return {
      leaderCommunities:
        communities?.filter((community) =>
          community.leaders.some((leader) => leader.id === user?.id)
        ) ?? [],
      nonLeaderCommunities:
        communities?.filter(
          (community) =>
            !community.leaders.some((leader) => leader.id === user?.id)
        ) ?? [],
    };
  }, [communities, user?.id]);

  const memberCommunityIds = useMemo(() => {
    return new Set((communities ?? []).map((community) => community.id));
  }, [communities]);

  const [publicCommunities, setPublicCommunities] = useState<CommunityDto[]>(
    []
  );
  const [publicCommunitiesLoading, setPublicCommunitiesLoading] =
    useState(false);
  const [publicCommunitiesError, setPublicCommunitiesError] = useState<
    string | null
  >(null);
  const [joiningCommunityId, setJoiningCommunityId] = useState<number | null>(
    null
  );

  useEffect(() => {
    setPublicCommunitiesLoading(true);
    setPublicCommunitiesError(null);
    void (async () => {
      const response = await userGetPublicCommunities();
      if (response.data) {
        setPublicCommunities(response.data);
      } else {
        setPublicCommunitiesError("Unable to load public groups.");
      }
      setPublicCommunitiesLoading(false);
    })();
  }, []);

  const getRemovalMessage = useCallback(
    (targetName?: string) => {
      if (!nonLeaderCommunities.length) {
        return null;
      }
      const names = nonLeaderCommunities.map((community) => community.name);
      const base =
        names.length === 1
          ? `your current group (${names[0]})`
          : `the following groups: (${names.join(", ")})`;
      if (!targetName) {
        return `You will be removed from ${base}.`;
      }
      return `Joining ${targetName} will remove you from ${base}.`;
    },
    [nonLeaderCommunities]
  );

  const handleAcceptInvite = useCallback(
    async (inviteId: number, anchor?: HTMLElement | null) => {
      const message = getRemovalMessage();
      const ok = message
        ? await confirm({
            title: "Accept invite?",
            message,
            confirmLabel: "Accept",
            cancelLabel: "Cancel",
            anchorEl: anchor,
            placement: "topleft",
          })
        : true;

      if (ok) {
        void acceptCommunityInvite(inviteId).then(() => {
          onSelectCommunity(
            incomingCommunityInvitesById.get(inviteId)?.community.id
          );
        });
      }
    },
    [
      onSelectCommunity,
      incomingCommunityInvitesById,
      acceptCommunityInvite,
      confirm,
      getRemovalMessage,
    ]
  );

  const onLeaveGroup = useCallback(
    async (community: CommunityDto, anchor: HTMLElement | null) => {
      const ok = await confirm({
        title: `Leave group? (${community.name})`,
        message: leaveGroupConfirmation,
        anchorEl: anchor,
        confirmLabel: "Leave",
        cancelLabel: "Cancel",
        placement: "topleft",
      });
      if (ok) {
        const response = await userLeaveCommunity({
          path: { communityId: community.id },
        });
        if (response.data) {
          onSelectCommunity(null);
        }
      }
    },
    [confirm, onSelectCommunity]
  );

  const handleRequestAssignment = useCallback(
    async (anchor?: HTMLElement | null) => {
      const ok = !!nonLeaderCommunities.length
        ? await confirm({
            title: "Group assignment",
            message: requestGroupAssignmentConfirmation,
            confirmLabel: "Yes, reassign me",
            cancelLabel: "No",
            anchorEl: anchor,
            placement: "topleft",
          })
        : true;
      if (ok) {
        await userJoinGroupAssignment();
        await refreshUser();
      }
    },
    [confirm, nonLeaderCommunities.length, refreshUser]
  );

  const handleCancelAssignment = useCallback(async () => {
    await userLeaveGroupAssignment();
    await refreshUser();
  }, [refreshUser]);

  const handleJoinPublicCommunity = useCallback(
    async (community: CommunityDto, anchor?: HTMLElement | null) => {
      const message = getRemovalMessage(community.name);
      const ok = message
        ? await confirm({
            title: "Join public group?",
            message,
            confirmLabel: "Join group",
            cancelLabel: "Cancel",
            anchorEl: anchor,
            placement: "topleft",
          })
        : true;
      if (!ok) {
        return;
      }
      setJoiningCommunityId(community.id);
      try {
        const response = await userJoinPublicCommunity({
          path: { communityId: community.id },
        });
        if (!response.data) {
          throw new Error("No community returned");
        }
        success(`You joined ${community.name}.`);
        await refreshUser();
        onSelectCommunity(response.data.id);
      } catch (err) {
        console.error("Failed to join public community", err);
        showError("Unable to join that group right now.");
      } finally {
        setJoiningCommunityId(null);
      }
    },
    [
      confirm,
      getRemovalMessage,
      onSelectCommunity,
      refreshUser,
      showError,
      success,
    ]
  );

  const handleCreateSuccess = useCallback(
    (community: CommunityDto) => {
      setShowCreateForm(false);
      onSelectCommunity(community.id);
    },
    [onSelectCommunity]
  );

  const handleCreateCancel = useCallback(() => {
    setShowCreateForm(false);
  }, []);

  return (
    <div className="flex flex-col gap-y-12 py-8">
      {onBack && (
        <Button color={ButtonColor.White} onClick={onBack}>
          <ChevronLeft size="16" /> Back to group
        </Button>
      )}
      {/* Leader groups */}
      <div>
        {!!(leaderCommunities.length || !isOnboardingGroupMember) && (
          <div className="flex flex-col gap-y-4">
            <div className="flex flex-col gap-y-1">
              <p className="font-semibold text-xl md:text-2xl">
                Groups you lead
              </p>
              <p className="text-zinc-500 text-base">
                You can lead as many groups as you want.
              </p>
            </div>
            <List>
              {[
                ...(leaderCommunities.map((community) => {
                  return (
                    <Button
                      key={community.id}
                      color={ButtonColor.White}
                      className="w-full !rounded-none border-none !p-4"
                      onClick={() => onSelectCommunity(community.id)}
                    >
                      <div className={"w-full flex flex-row justify-between"}>
                        <div className="flex flex-row gap-x-3">
                          <ProfileImage
                            pfp={community.photo ?? null}
                            size="huge"
                          />
                          <div className="flex flex-col text-left">
                            <p className="text-lg font-semibold">
                              {community.name}
                            </p>
                            <p className="text-zinc-500">
                              {community.description}
                            </p>
                            <span className="text-zinc-500">
                              {community.users.length}{" "}
                              {community.users.length === 1
                                ? "member"
                                : "members"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Button>
                  );
                }) ?? []),
                !isOnboardingGroupMember && (
                  <Fragment key="create-group">
                    <Button
                      onClick={() => setShowCreateForm(!showCreateForm)}
                      color={
                        showCreateForm ? ButtonColor.Light : ButtonColor.White
                      }
                      className="w-full !rounded-none border-t border-t-zinc-200 border-x-0 border-b-0"
                    >
                      <div className="w-full flex flex-row gap-x-2 items-center justify-center p-2 text-zinc-500">
                        {showCreateForm ? (
                          <Minus size="14" />
                        ) : (
                          <Plus size="14" />
                        )}{" "}
                        Create group
                      </div>
                    </Button>
                    {!!showCreateForm && (
                      <div className="p-4 flex flex-col gap-y-4">
                        <CommunityCreateForm
                          name={user?.name}
                          onCancel={handleCreateCancel}
                          onSuccess={handleCreateSuccess}
                        />
                      </div>
                    )}
                  </Fragment>
                ),
              ]}
            </List>
          </div>
        )}
      </div>

      {/* Non-leader groups */}
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-2 md:flex-row w-full justify-between md:items-center">
          <div className="flex flex-col gap-y-1">
            <p className="font-semibold text-xl md:text-2xl">
              Groups you&apos;re a member of
              {!user?.undergoingGroupAssignment
                ? ""
                : nonLeaderCommunities.length
                ? " (reassigning...)"
                : " (assigning...)"}
            </p>
            <p className="text-zinc-500 text-base">
              For now, you can only be a member of one group.
            </p>
          </div>
          {user?.undergoingGroupAssignment ? (
            <Button color={ButtonColor.Black} onClick={handleCancelAssignment}>
              {nonLeaderCommunities.length
                ? "Cancel reassignment"
                : "Cancel assignment"}
            </Button>
          ) : (
            <Button
              className="justify-self-end"
              color={ButtonColor.Grey}
              onClick={(event) =>
                void handleRequestAssignment(event.currentTarget)
              }
            >
              {nonLeaderCommunities.length
                ? "Request reassignment"
                : "Request assignment"}
            </Button>
          )}
        </div>
        {nonLeaderCommunities.length ? (
          <List>
            {nonLeaderCommunities.map((community) => {
              return (
                <Button
                  key={community.id}
                  color={ButtonColor.White}
                  className="w-full !rounded-none border-none !p-4"
                  onClick={() => onSelectCommunity(community.id)}
                >
                  <div className={"w-full flex flex-row justify-between"}>
                    <div className="flex flex-row gap-x-3">
                      <ProfileImage pfp={community.photo ?? null} size="huge" />
                      <div className="flex flex-col text-left">
                        <p className="text-lg font-semibold">
                          {community.name}
                        </p>
                        <p className="text-zinc-500">{community.description}</p>
                        <span className="text-zinc-500">
                          {community.users.length}{" "}
                          {community.users.length === 1 ? "member" : "members"}
                        </span>
                      </div>
                    </div>
                    <Button
                      color={ButtonColor.Red}
                      size="small"
                      onClick={(event) => {
                        event.stopPropagation();
                        void onLeaveGroup(community, event.currentTarget);
                      }}
                    >
                      Leave
                    </Button>
                  </div>
                </Button>
              );
            })}
          </List>
        ) : (
          <span>You are not a member of any group</span>
        )}
      </div>

      {/* Pending group invites */}
      {!!pendingCommunityInvites.length && (
        <div className="flex flex-col gap-y-2">
          <p className="font-semibold text-xl md:text-2xl">
            You have pending group invites
          </p>
          <CommunityInviteList
            invites={pendingCommunityInvites}
            onAccept={handleAcceptInvite}
            onDecline={handleDeclineInvite}
          />
        </div>
      )}

      {/* Public groups */}
      <div className="flex flex-col gap-y-4">
        <div className="flex flex-col gap-y-1">
          <p className="font-semibold text-xl md:text-2xl">Public groups</p>
          <p className="text-zinc-500 text-base">
            Groups you can join at any time.
          </p>
        </div>

        {publicCommunitiesLoading ? (
          <div className="flex flex-row items-center gap-x-2 text-zinc-500">
            <Spinner size="small" />
            <span>Loading public groups...</span>
          </div>
        ) : publicCommunitiesError ? (
          <span className="text-red-500">{publicCommunitiesError}</span>
        ) : publicCommunities.length ? (
          <List>
            {publicCommunities.map((community) => {
              const isMember = memberCommunityIds.has(community.id);
              const isLeader = community.leaders.some(
                (leader) => leader.id === user?.id
              );
              const isFull =
                community.maxCapacity !== null &&
                community.users.length >= community.maxCapacity;
              const isJoining = joiningCommunityId === community.id;
              const joinDisabled = isMember || isLeader || isFull || isJoining;

              const joinLabel = isLeader
                ? "Leader"
                : isMember
                ? "Member"
                : isFull
                ? "Full"
                : isJoining
                ? "Joining..."
                : "Join";

              return (
                <div
                  key={community.id}
                  className="flex flex-col gap-y-2 p-4 md:flex-row md:items-start md:justify-between"
                >
                  <div className="flex flex-row gap-x-3">
                    <ProfileImage pfp={community.photo ?? null} size="huge" />
                    <div className="flex flex-col">
                      <p className="text-lg font-semibold">{community.name}</p>
                      {community.description && (
                        <p className="text-zinc-500">{community.description}</p>
                      )}
                      <span className="text-zinc-500">
                        {community.users.length}
                        {community.maxCapacity !== null
                          ? ` / ${community.maxCapacity}`
                          : ""}{" "}
                        members
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end md:justify-start">
                    <Button
                      color={ButtonColor.Black}
                      size="small"
                      disabled={joinDisabled}
                      onClick={(event) =>
                        void handleJoinPublicCommunity(
                          community,
                          event.currentTarget
                        )
                      }
                    >
                      {joinLabel}
                    </Button>
                  </div>
                </div>
              );
            })}
          </List>
        ) : (
          <span>No public groups are available right now.</span>
        )}
      </div>
    </div>
  );
};

export default MyGroupsPage;
