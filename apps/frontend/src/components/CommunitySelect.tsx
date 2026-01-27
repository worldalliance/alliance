import {
  CommunityDto,
  userJoinGroupAssignment,
  userLeaveCommunity,
  userLeaveGroupAssignment,
} from "@alliance/shared/client";
import List from "@alliance/sharedweb/ui/List";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useAuth } from "../lib/AuthContext";
import { Plus } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import React from "react";
import useIncomingCommunityInvites from "@alliance/shared/lib/useIncomingCommunityInvites";
import CommunityInviteList from "./CommunityInviteList";
import {
  leaveGroupConfirmation,
  requestGroupAssignmentConfirmation,
} from "@alliance/shared/lib/copy";

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
  const { confirm } = useToast();
  const {
    pendingCommunityInvites,
    incomingCommunityInvitesById,
    acceptCommunityInvite,
    declineCommunityInvite,
  } = useIncomingCommunityInvites();

  const handleAcceptInvite = useCallback(
    async (inviteId: number, anchor?: HTMLElement | null) => {
      const nonLeaderCommunities = communities
        ?.filter(
          (c) => !c.leaders.some(({ id: userId }) => userId === user?.id)
        )
        .map((c) => c.name);
      const message = !nonLeaderCommunities?.length
        ? null
        : nonLeaderCommunities.length === 1
        ? `You will be removed from your current group (${nonLeaderCommunities[0]})`
        : `You will be removed from the following groups: (${nonLeaderCommunities.join(
            ", "
          )})`;
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
      communities,
      user,
    ]
  );

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
