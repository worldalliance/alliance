import {
  CommunityDto,
  communityJoinPublicCommunity,
} from "@alliance/shared/client";
import {
  getMemberCount,
  publicGroupJoinState,
} from "@alliance/shared/lib/communityUtils";
import { usePublicCommunities } from "@alliance/shared/lib/usePublicCommunities";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import List from "@alliance/sharedweb/ui/List";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { ToastPlacement, useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useCallback, useState } from "react";
import { useAuth } from "../../lib/AuthContext";

export type PublicGroupsSectionProps = {
  memberCommunityIds: Set<number>;
  didGroupsFail: boolean;
  getRemovalMessage: (targetName?: string) => string | null;
  onSelectCommunity: (communityId: number) => void;
  refreshCommunities: () => Promise<void>;
};

const PublicGroupsSection = ({
  memberCommunityIds,
  didGroupsFail,
  getRemovalMessage,
  onSelectCommunity,
  refreshCommunities,
}: PublicGroupsSectionProps) => {
  const { user, refreshUser } = useAuth();
  const { confirm, error: showError, success } = useToast();

  const {
    publicCommunities,
    isLoading: publicCommunitiesLoading,
    isError: publicCommunitiesError,
    refetch: refetchPublicCommunities,
  } = usePublicCommunities();
  const [joiningCommunityId, setJoiningCommunityId] = useState<number | null>(
    null,
  );

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
            placement: ToastPlacement.TopLeft,
          })
        : true;
      if (!ok) {
        return;
      }
      setJoiningCommunityId(community.id);
      try {
        const response = await communityJoinPublicCommunity({
          path: { communityId: community.id },
        });
        if (!response.data) {
          throw new Error("No group returned");
        }
        success(`You joined ${community.name}.`);
        await Promise.all([
          refreshUser(),
          refreshCommunities(),
          refetchPublicCommunities(),
        ]);
        onSelectCommunity(response.data.id);
      } catch (err) {
        console.error("Failed to join public group", err);
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
      refreshCommunities,
      refetchPublicCommunities,
      showError,
      success,
    ],
  );

  return (
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
        <span className="text-red-500">Unable to load public groups.</span>
      ) : publicCommunities.length ? (
        <List>
          {publicCommunities.map((community) => {
            const memberCount = getMemberCount(community);
            const { disabled: joinDisabled, label: joinLabel } =
              publicGroupJoinState({
                community,
                userId: user?.id,
                isMember: memberCommunityIds.has(community.id),
                isJoining: joiningCommunityId === community.id,
                didGroupsFail,
              });

            return (
              <div
                key={community.id}
                className="flex flex-col gap-y-2 p-4 md:flex-row md:items-start md:justify-between"
              >
                <div className="flex flex-row gap-x-3">
                  <AvatarProfile pfp={community.photo ?? null} size="huge" />
                  <div className="flex flex-col">
                    <p className="text-lg font-semibold">{community.name}</p>
                    {community.description && (
                      <p className="text-zinc-500">{community.description}</p>
                    )}
                    <span className="text-zinc-500">
                      {memberCount}
                      {community.maxCapacity !== null
                        ? ` / ${Math.max(community.maxCapacity, memberCount)}`
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
                        event.currentTarget,
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
  );
};

export default PublicGroupsSection;
