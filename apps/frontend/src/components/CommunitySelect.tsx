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
import { useAuth } from "../lib/AuthContext";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import React from "react";
import useIncomingCommunityInvites from "@alliance/shared/lib/useIncomingCommunityInvites";
import CommunityInviteList from "./CommunityInviteList";
import {
  leaveGroupConfirmation,
  requestGroupAssignmentConfirmation,
} from "@alliance/shared/lib/copy";
import Spinner from "@alliance/sharedweb/ui/Spinner";

export type CommunitySelectProps = {
  communities: CommunityDto[] | null;
  currentCommunityId?: number | null;
  onSelectCommunity: (communityId: number | null | undefined) => void;
  isOnboardingGroupMember: boolean;
  onCreateCommunity: () => void;
};

const CommunitySelect = ({
  communities,
  currentCommunityId,
  onSelectCommunity,
  isOnboardingGroupMember,
  onCreateCommunity,
}: CommunitySelectProps) => {
  const { user, refreshUser } = useAuth();
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
            confirmLabel: "Yes, reassign me!",
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

  return (
    <div className="flex flex-col gap-y-8 py-8">
      <div>
        {!!(leaderCommunities.length || !isOnboardingGroupMember) && (
          <>
            <p className="font-semibold text-xl md:text-2xl">Leader groups</p>
            <List>
              {[
                ...(leaderCommunities.map((community) => {
                  const isCurrent = community.id === currentCommunityId;
                  return (
                    <Button
                      key={community.id}
                      color={
                        isCurrent ? ButtonColor.LightHover : ButtonColor.White
                      }
                      className="w-full !rounded-none"
                      onClick={() => onSelectCommunity(community.id)}
                    >
                      <div
                        className={"w-full flex flex-row justify-between m-2"}
                      >
                        <div className="flex flex-col gap-y-1 text-left">
                          <p className="text-xl font-semibold">
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
                    </Button>
                  );
                }) ?? []),
                !isOnboardingGroupMember && (
                  <Button
                    key="create"
                    onClick={onCreateCommunity}
                    color={ButtonColor.White}
                    className="w-full !rounded-none"
                  >
                    <div className="w-full flex flex-row gap-x-2 items-center justify-center m-3 text-zinc-500">
                      <Plus size="14" /> Create a new group
                    </div>
                  </Button>
                ),
              ]}
            </List>
          </>
        )}
      </div>

      <div className="flex flex-col gap-y-2">
        <div className="flex flex-row w-full justify-between items-center">
          <p className="font-semibold text-xl md:text-2xl">
            Member groups
            {!user?.undergoingGroupAssignment
              ? ""
              : nonLeaderCommunities.length
              ? " (reassigning...)"
              : " (assigning...)"}
          </p>
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
          nonLeaderCommunities.map((community) => {
            const isCurrent = community.id === currentCommunityId;
            return (
              <React.Fragment key={community.id}>
                <Button
                  color={isCurrent ? ButtonColor.LightHover : ButtonColor.White}
                  className="w-full !rounded-none"
                  onClick={() => onSelectCommunity(community.id)}
                >
                  <div className={"w-full flex flex-row justify-between m-2"}>
                    <div className="flex flex-col gap-y-1 text-left">
                      <p className="text-xl font-semibold">{community.name}</p>
                      <p className="text-zinc-500">{community.description}</p>
                      <span className="text-zinc-500">
                        {community.users.length}{" "}
                        {community.users.length === 1 ? "member" : "members"}
                      </span>
                    </div>
                  </div>
                </Button>
                <div className="w-full flex flex-row justify-end">
                  <Button
                    color={ButtonColor.Red}
                    onClick={(event) =>
                      void onLeaveGroup(community, event.currentTarget)
                    }
                  >
                    Leave group
                  </Button>
                </div>
              </React.Fragment>
            );
          })
        ) : (
          <span>You are not a member of any groups</span>
        )}
        <div className="mt-4 flex flex-col gap-y-3">
          <p className="font-semibold text-xl">Public groups</p>

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
                const joinDisabled =
                  isMember || isLeader || isFull || isJoining;

                const joinLabel = isLeader
                  ? "Leader"
                  : isMember
                  ? "Member"
                  : isFull
                  ? "Full"
                  : isJoining
                  ? "Joining..."
                  : "Join group";

                return (
                  <div
                    key={community.id}
                    className="flex flex-col gap-y-2 p-4 md:flex-row md:items-start md:justify-between"
                  >
                    <div className="flex flex-col gap-y-1">
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
                    <div className="flex justify-end md:justify-start">
                      <Button
                        color={ButtonColor.Black}
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

      <div>
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
      </div>
    </div>
  );
};

export default CommunitySelect;
