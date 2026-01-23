import { useCallback, useEffect, useState } from "react";
import {
  CommunityInviteDto,
  userAcceptCommunityInvite,
  userGetCommunityInvitesForUser,
  userRejectCommunityInvite,
} from "@alliance/shared/client";

type UseCommunityInvitesReturn = {
  invites: CommunityInviteDto[];
  loadingCommunityInvites: boolean;
  acceptInvite: (inviteId: number) => void;
  declineInvite: (inviteId: number) => void;
};

const useCommunityInvites = (): UseCommunityInvitesReturn => {
  const [invites, setInvites] = useState<CommunityInviteDto[]>([]);
  const [loadingCommunityInvites, setLoadingCommunityInvites] = useState(true);

  useEffect(() => {
    userGetCommunityInvitesForUser()
      .then((response) => {
        if (response.data) {
          setInvites(response.data);
        }
      })
      .finally(() => {
        setLoadingCommunityInvites(false);
      });
  }, []);

  const acceptInvite = useCallback((inviteId: number) => {
    userAcceptCommunityInvite({ path: { inviteId } }).then((response) => {
      if (response.data) {
        window.location.reload();
      }
    });
  }, []);

  const declineInvite = useCallback((inviteId: number) => {
    userRejectCommunityInvite({ path: { inviteId } }).then((response) => {
      if (response.data) {
        setInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
      }
    });
  }, []);

  return { invites, loadingCommunityInvites, acceptInvite, declineInvite };
};

export default useCommunityInvites;
