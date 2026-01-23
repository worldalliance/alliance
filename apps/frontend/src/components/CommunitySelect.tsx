import { CommunityDto } from "@alliance/shared/client";
import List from "@alliance/sharedweb/ui/List";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useAuth } from "../lib/AuthContext";
import { Plus } from "lucide-react";

export type CommunitySelectProps = {
  communities: CommunityDto[] | null;
  currentCommunityId?: number | null;
  onSelectCommunity: (communityId: number) => void;
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

  if ((!communities || communities.length === 0) && isOnboardingGroupMember) {
    return (
      <div className="py-4">
        <p className="text-sm text-zinc-500">No other groups to select.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-3 py-4">
      <p className="font-semibold text-xl md:text-2xl">
        Select a group to view
      </p>
      <List>
        {[
          ...(communities?.map((community) => {
            const isLeader = community.leaders.some(
              (leader) => leader.id === user?.id
            );
            const isCurrent = community.id === currentCommunityId;
            return (
              <Button
                key={community.id}
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
                  {isLeader && <span className="text-green">Leader</span>}
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
    </div>
  );
};

export default CommunitySelect;
