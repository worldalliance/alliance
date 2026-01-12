import { useCallback, useEffect, useState } from "react";
import {
  CommunityInviteDto,
  userAcceptCommunityInvite,
  userGetCommunityInvitesForUser,
  userRejectCommunityInvite,
} from "@alliance/shared/client";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import List from "@alliance/sharedweb/ui/List";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";

const NoCommunityPage = () => {
  const [communityInvites, setCommunityInvites] = useState<
    CommunityInviteDto[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    userGetCommunityInvitesForUser()
      .then((response) => {
        if (response.data) {
          setCommunityInvites(response.data);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleAcceptInvite = useCallback((inviteId: number) => {
    userAcceptCommunityInvite({ path: { inviteId } }).then((response) => {
      if (response.data) {
        window.location.reload();
      }
    });
  }, []);

  const handleDeclineInvite = useCallback((inviteId: number) => {
    userRejectCommunityInvite({ path: { inviteId } }).then((response) => {
      if (response.data) {
        setCommunityInvites((prev) =>
          prev.filter((invite) => invite.id !== inviteId)
        );
      }
    });
  }, []);
  if (loading) {
    return <Spinner />;
  }
  if (communityInvites.length === 0) {
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
      <List>
        {communityInvites.map((invite) => (
          <div
            key={invite.id}
            className="flex flex-row gap-x-2 p-4 justify-between items-center"
          >
            <p>{invite.community.name}</p>
            <div className="flex flex-row gap-3 items-center">
              <Button
                onClick={() => handleAcceptInvite(invite.id)}
                color={ButtonColor.Green}
              >
                Accept
              </Button>
              <Button
                onClick={() => handleDeclineInvite(invite.id)}
                color={ButtonColor.Light}
              >
                Decline
              </Button>
            </div>
          </div>
        ))}
      </List>
    </CenterLayout>
  );
};

export default NoCommunityPage;
