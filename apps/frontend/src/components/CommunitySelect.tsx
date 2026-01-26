import { CommunityDto, userLeaveCommunity } from "@alliance/shared/client";
import List from "@alliance/sharedweb/ui/List";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useAuth } from "../lib/AuthContext";
import { Plus } from "lucide-react";
import { useCallback, useMemo } from "react";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import React from "react";

export type CommunitySelectProps = {
  communities: CommunityDto[] | null;
  currentCommunityId?: number | null;
  onSelectCommunity: (communityId: number | null) => void;
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
  const { user } = useAuth();

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

  const { confirm } = useToast();

  const onLeaveGroup = useCallback(
    async (community: CommunityDto, anchor: HTMLElement | null) => {
      const ok = await confirm({
        title: `Leave group? (${community.name})`,
        message: `Are you sure you want to leave this group? You will not be able to rejoin unless you are invited again.`,
        anchorEl: anchor,
        confirmLabel: "Leave",
        cancelLabel: "Cancel",
        placement: "topleft",
      });
      if (ok) {
        await userLeaveCommunity({ path: { communityId: community.id } });
        onSelectCommunity(null);
      }
    },
    [confirm, onSelectCommunity]
  );

  if ((!communities || communities.length === 0) && isOnboardingGroupMember) {
    return (
      <div className="py-4">
        <p className="text-sm text-zinc-500">No other groups to select.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-3 py-4">
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
                    <div className={"w-full flex flex-row justify-between m-2"}>
                      <div className="flex flex-col gap-y-1 text-left">
                        <p className="text-xl font-semibold">
                          {community.name}
                        </p>
                        <p className="text-zinc-500">{community.description}</p>
                        <span className="text-zinc-500">
                          {community.users.length}{" "}
                          {community.users.length === 1 ? "member" : "members"}
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
      {!!nonLeaderCommunities.length && (
        <>
          <p className="font-semibold text-xl md:text-2xl">Member groups</p>
          {nonLeaderCommunities.map((community) => {
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
          })}
        </>
      )}
    </div>
  );
};

export default CommunitySelect;
