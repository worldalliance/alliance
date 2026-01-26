import { useCallback } from "react";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";
import CommunityInviteList from "../../components/CommunityInviteList";
import useIncomingCommunityInvites from "@alliance/shared/lib/useIncomingCommunityInvites";

const NoCommunityPage = () => {
  const {
    pendingCommunityInvites,
    acceptCommunityInvite,
    declineCommunityInvite,
  } = useIncomingCommunityInvites();

  const handleAcceptInvite = useCallback(
    (inviteId: number) => {
      void acceptCommunityInvite(inviteId).then(() => {
        window.location.reload();
      });
    },
    [acceptCommunityInvite]
  );

  const handleDeclineInvite = useCallback(
    (inviteId: number) => {
      void declineCommunityInvite(inviteId);
    },
    [declineCommunityInvite]
  );

  if (pendingCommunityInvites.length === 0) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-var(--nav-height))]">
        <div className="flex flex-col gap-y-2 m-4">
          <p className="font-medium">You are not a member of a group yet</p>
          <p>
            If you receive a group invite, you will be able to join the
            community here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <CenterLayout>
      <div className="flex flex-col gap-y-2 m-4">
        <p className="font-medium">You have pending group invites</p>
      </div>
      <CommunityInviteList
        invites={pendingCommunityInvites}
        onAccept={handleAcceptInvite}
        onDecline={handleDeclineInvite}
      />
    </CenterLayout>
  );
};

export default NoCommunityPage;
