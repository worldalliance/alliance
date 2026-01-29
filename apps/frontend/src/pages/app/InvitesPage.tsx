import {
  CommunityDto,
  OnetimeInviteDto,
  userApproveOnetimeInvite,
  userDeleteOnetimeInvite,
  userGetMyCommunities,
  userGetOnetimeInvitesOverview,
  userRejectOnetimeInvite,
} from "@alliance/shared/client";
import List from "@alliance/sharedweb/ui/List";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import { getBaseUrl } from "@alliance/sharedweb/lib/config";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import TwoColumnLayout from "../../components/TwoColumnLayout";
import OnetimeInviteListItem from "../../components/OnetimeInviteListItem";
import { bucketOnetimeInvitesByActionability } from "@alliance/shared/lib/inviteUtils";

const InvitesPage = () => {
  const { user } = useAuth();
  const { error: errorToast, confirm } = useToast();
  const [communities, setCommunities] = useState<CommunityDto[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invites, setInvites] = useState<OnetimeInviteDto[]>([]);

  useEffect(() => {
    userGetMyCommunities().then((resp) => {
      if (resp.data) {
        setCommunities(resp.data);
      }
    });
  }, []);

  useEffect(() => {
    void (async () => {
      setLoadingInvites(true);
      const response = await userGetOnetimeInvitesOverview();
      if (response.data) {
        setInvites(response.data);
        setError(null);
      } else {
        setError("Failed to load invites");
      }
      setLoadingInvites(false);
    })();
  }, []);

  const leaderCommunityIds = useMemo(() => {
    if (!user) {
      return new Set<number>();
    }
    return new Set(
      communities
        .filter((community) =>
          community.leaders.some((leader) => leader.id === user.id)
        )
        .map((community) => community.id)
    );
  }, [communities, user]);

  const { actionable, unverifiableActionable, waitingForResponse, settled } =
    useMemo(() => {
      if (!user) {
        return {
          actionable: [],
          unverifiableActionable: [],
          waitingForResponse: [],
          settled: [],
        };
      }
      return bucketOnetimeInvitesByActionability({
        invites,
        leaderCommunityIds,
        userId: user.id,
      });
    }, [invites, leaderCommunityIds, user]);

  const copyToClipboard = (text: string) => {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/signup?ref=${text}`;
    navigator.clipboard.writeText(url);
  };

  const handleApproveInvite = (inviteId: number) => {
    void (async () => {
      const response = await userApproveOnetimeInvite({
        path: { inviteId },
      });
      if (!response.data) {
        errorToast(`Failed to approve invite: ${response.response.statusText}`);
        return;
      }

      setInvites((prev) =>
        prev.map((invite) => (invite.id === inviteId ? response.data : invite))
      );
    })();
  };

  const handleRejectInvite = (inviteId: number) => {
    void (async () => {
      const response = await userRejectOnetimeInvite({
        path: { inviteId },
      });

      if (response.error) {
        errorToast(`Failed to reject invite: ${response.response.statusText}`);
        return;
      }

      setInvites((prev) => prev.filter((request) => request.id !== inviteId));
    })();
  };

  const handleDeleteInvite = (
    inviteId: number,
    event: React.MouseEvent<HTMLElement>
  ) => {
    void (async () => {
      const ok = await confirm({
        message: "Are you sure you want to delete this invite?",
        confirmLabel: "Yes, delete it!",
        cancelLabel: "No, keep it",
        anchorEl: event.currentTarget,
        placement: "topleft",
      });
      if (!ok) {
        return;
      }

      const response = await userDeleteOnetimeInvite({ path: { inviteId } });
      if (!response.error) {
        setInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
      }
    })();
  };

  const handleDeleteRequest = (inviteId: number) => {
    void (async () => {
      const response = await userDeleteOnetimeInvite({ path: { inviteId } });
      if (!response.error) {
        setInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
      }
    })();
  };

  if (!user || loadingInvites) {
    return <Spinner />;
  }

  const inviteForm = null;

  return (
    <TwoColumnLayout
      main={
        <div className="p-5 xl:p-10 xl:pr-5 max-w-[900px] mx-auto px-0 md:px-3">
          <div className="flex flex-col gap-y-8 py-6 px-5 md:px-0">
            <div className="flex flex-col gap-y-3">
              <p className="font-semibold text-2xl md:text-3xl">Invites</p>
              {inviteForm}
              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>

            {actionable.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <p className="font-semibold text-xl">Invites to be approved</p>
                <List>
                  {actionable.map((request) => (
                    <OnetimeInviteListItem
                      key={request.id}
                      invite={request}
                      showOnetimeInviteLabel={false}
                      showCommunityLabel={true}
                      communityLabel={request.community?.name}
                      selfInvited={user.id === request.invitingUser?.id}
                      onApprove={handleApproveInvite}
                      onReject={handleRejectInvite}
                    />
                  ))}
                </List>
              </div>
            )}

            {unverifiableActionable.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <p className="font-semibold text-xl">Invites to be sent</p>
                <List>
                  {unverifiableActionable.map((invite) => (
                    <OnetimeInviteListItem
                      key={invite.id}
                      invite={invite}
                      showOnetimeInviteLabel={false}
                      showCommunityLabel={true}
                      communityLabel={invite.community?.name}
                      selfInvited={user.id === invite.invitingUser?.id}
                      onDelete={handleDeleteInvite}
                      onCopy={copyToClipboard}
                    />
                  ))}
                </List>
              </div>
            )}

            {waitingForResponse.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <p className="font-semibold text-xl">Waiting on response</p>
                <List>
                  {waitingForResponse.map((request) => (
                    <OnetimeInviteListItem
                      key={request.id}
                      invite={request}
                      showOnetimeInviteLabel={false}
                      showCommunityLabel={true}
                      communityLabel={request.community?.name}
                      selfInvited={user.id === request.invitingUser?.id}
                      onDelete={(inviteId) => handleDeleteRequest(inviteId)}
                    />
                  ))}
                </List>
              </div>
            )}

            {settled.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <p className="font-semibold text-xl">Past invites</p>
                <List>
                  {settled.map((invite) => (
                    <OnetimeInviteListItem
                      key={invite.id}
                      invite={invite}
                      showOnetimeInviteLabel={false}
                      showCommunityLabel={true}
                      communityLabel={invite.community?.name}
                      selfInvited={user.id === invite.invitingUser?.id}
                      onCopy={copyToClipboard}
                    />
                  ))}
                </List>
              </div>
            )}
          </div>
        </div>
      }
    />
  );
};

export default InvitesPage;
