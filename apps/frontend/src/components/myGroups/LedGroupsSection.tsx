import { CommunityDto } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import List from "@alliance/sharedweb/ui/List";
import { Minus, Plus } from "lucide-react";
import { Fragment, useCallback, useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import CommunityCreateForm from "../CommunityCreateForm";
import MyGroupSummary from "./MyGroupSummary";

export type LedGroupsSectionProps = {
  communities: CommunityDto[];
  onSelectCommunity: (communityId: number) => void;
};

const LedGroupsSection = ({
  communities,
  onSelectCommunity,
}: LedGroupsSectionProps) => {
  const { user } = useAuth();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleCreateSuccess = useCallback(
    (community: CommunityDto) => {
      setShowCreateForm(false);
      onSelectCommunity(community.id);
    },
    [onSelectCommunity],
  );

  const handleCreateCancel = useCallback(() => {
    setShowCreateForm(false);
  }, []);

  return (
    <div className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-y-1">
        <p className="font-semibold text-xl md:text-2xl">Groups you lead</p>
        <p className="text-zinc-500 text-base">
          You can lead as many groups as you want.
        </p>
      </div>
      <List>
        {[
          ...communities.map((community) => (
            <Button
              key={community.id}
              color={ButtonColor.White}
              className="w-full !rounded-none border-none !p-4"
              onClick={() => onSelectCommunity(community.id)}
            >
              <div className={"w-full flex flex-row justify-between"}>
                <MyGroupSummary community={community} />
              </div>
            </Button>
          )),
          <Fragment key="create-group">
            <Button
              onClick={() => setShowCreateForm(!showCreateForm)}
              color={showCreateForm ? ButtonColor.Light : ButtonColor.White}
              className={cn(
                "w-full !rounded-none",
                communities.length
                  ? "border-t border-t-zinc-200 border-x-0 border-b-0"
                  : "border-0",
              )}
            >
              <div className="w-full flex flex-row gap-x-2 items-center justify-center p-2 text-zinc-500">
                {showCreateForm ? <Minus size="14" /> : <Plus size="14" />}{" "}
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
          </Fragment>,
        ]}
      </List>
    </div>
  );
};

export default LedGroupsSection;
