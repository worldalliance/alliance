import {
  groupRemovalMessage,
  isLedBy,
} from "@alliance/shared/lib/communityUtils";
import { useIncomingCommunityInvites } from "@alliance/shared/lib/useIncomingCommunityInvites";
import { useMyCommunities } from "@alliance/shared/lib/useMyCommunities";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { ToastPlacement, useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { ChevronLeft } from "lucide-react";
import { useCallback, useMemo } from "react";
import CommunityInviteList from "../../components/CommunityInviteList";
import LoadFailed from "../../components/LoadFailed";
import LedGroupsSection from "../../components/myGroups/LedGroupsSection";
import MemberGroupsSection from "../../components/myGroups/MemberGroupsSection";
import PublicGroupsSection from "../../components/myGroups/PublicGroupsSection";
import { useAuth } from "../../lib/AuthContext";

export type MyGroupsPageProps = {
  onSelectCommunity: (communityId: number | null | undefined) => void;
  onBack?: () => void;
};

const MyGroupsPage = ({ onSelectCommunity, onBack }: MyGroupsPageProps) => {
  const { user } = useAuth();
  const {
    communities,
    communityIds,
    didFail: didGroupsFail,
    isFetching,
    removeCommunity,
    refreshCommunities,
  } = useMyCommunities({
    selectedCommunityId: null,
  });
  const { confirm, error: showError } = useToast();
  const {
    pendingCommunityInvites,
    incomingCommunityInvitesById,
    didFail: didInvitesFail,
    isFetching: isFetchingInvites,
    refetch: refetchInvites,
    acceptCommunityInvite,
    declineCommunityInvite,
    isAnswering: isAnsweringInvite,
  } = useIncomingCommunityInvites();

  const handleDeclineInvite = useCallback(
    async (inviteId: number) => {
      try {
        await declineCommunityInvite(inviteId);
      } catch (err) {
        console.error("Failed to decline invite", err);
        showError("Unable to decline that invite right now.");
      }
    },
    [declineCommunityInvite, showError],
  );

  const { leaderCommunities, nonLeaderCommunities } = useMemo(() => {
    return {
      leaderCommunities:
        communities?.filter((community) => isLedBy(community, user?.id)) ?? [],
      nonLeaderCommunities:
        communities?.filter((community) => !isLedBy(community, user?.id)) ?? [],
    };
  }, [communities, user?.id]);

  const getRemovalMessage = useCallback(
    (targetName?: string) =>
      groupRemovalMessage(nonLeaderCommunities, targetName),
    [nonLeaderCommunities],
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
            placement: ToastPlacement.TopLeft,
          })
        : true;

      if (!ok) {
        return;
      }
      try {
        await acceptCommunityInvite(inviteId);
      } catch (err) {
        console.error("Failed to accept invite", err);
        showError("Unable to accept that invite right now.");
        return;
      }
      onSelectCommunity(
        incomingCommunityInvitesById.get(inviteId)?.community.id,
      );
    },
    [
      onSelectCommunity,
      incomingCommunityInvitesById,
      acceptCommunityInvite,
      confirm,
      getRemovalMessage,
      showError,
    ],
  );

  return (
    <div className="flex flex-col gap-y-12 py-8">
      {!!communities?.length && onBack && (
        <Button color={ButtonColor.White} onClick={onBack}>
          <ChevronLeft size="16" /> Back to group
        </Button>
      )}
      {didGroupsFail && (
        <LoadFailed
          message="Couldn't load your groups."
          onRetry={() => void refreshCommunities()}
          retrying={isFetching}
        />
      )}
      <LedGroupsSection
        communities={leaderCommunities}
        onSelectCommunity={onSelectCommunity}
      />

      <MemberGroupsSection
        communities={nonLeaderCommunities}
        didGroupsFail={didGroupsFail}
        onSelectCommunity={onSelectCommunity}
        removeCommunity={removeCommunity}
      />

      {/* Pending group invites */}
      {didInvitesFail && (
        <LoadFailed
          message="Couldn't load your group invites."
          onRetry={() => void refetchInvites()}
          retrying={isFetchingInvites}
        />
      )}
      {!!pendingCommunityInvites.length && (
        <div className="flex flex-col gap-y-2">
          <p className="font-semibold text-xl md:text-2xl">
            You have pending group invites
          </p>
          <CommunityInviteList
            invites={pendingCommunityInvites}
            acceptDisabled={didGroupsFail}
            answering={isAnsweringInvite}
            onAccept={handleAcceptInvite}
            onDecline={handleDeclineInvite}
          />
        </div>
      )}

      <PublicGroupsSection
        memberCommunityIds={communityIds}
        didGroupsFail={didGroupsFail}
        getRemovalMessage={getRemovalMessage}
        onSelectCommunity={onSelectCommunity}
        refreshCommunities={refreshCommunities}
      />
    </div>
  );
};

export default MyGroupsPage;
