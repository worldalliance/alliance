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
import OnetimeInviteListItem from "../../components/OnetimeInviteListItem";
import { bucketOnetimeInvitesByActionability } from "@alliance/shared/lib/inviteUtils";
import InviteForm from "../../components/InviteForm";
import CenterLayout from "@alliance/sharedweb/ui/CenterLayout";

const InvitesPage = () => {
  const { user } = useAuth();
  const { error: errorToast, confirm } = useToast();
  const [communities, setCommunities] = useState<CommunityDto[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invites, setInvites] = useState<OnetimeInviteDto[]>([]);

  const refreshCommunities = () => {
    userGetMyCommunities().then((resp) => {
      if (resp.data) {
        setCommunities(resp.data);
      }
    });
  };

  useEffect(() => {
    refreshCommunities();
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

  const handleInviteCreated = () => {
    // Refresh invites list
    void (async () => {
      const response = await userGetOnetimeInvitesOverview();
      if (response.data) {
        setInvites(response.data);
        setError(null);
      }
    })();
  };

  if (!user || loadingInvites) {
    return <Spinner />;
  }

  const inviteForm = (
    <InviteForm
      communities={communities}
      onInviteCreated={handleInviteCreated}
      onCommunitiesRefresh={refreshCommunities}
    />
  );

  return (
    <CenterLayout>
      <div className="flex flex-col gap-y-12">
        <div className="flex flex-col gap-y-3">
          <p className="font-serif font-semibold text-2xl md:text-3xl">
            Invites
          </p>
          {inviteForm}
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>

        {actionable.length > 0 && (
          <div className="flex flex-col gap-y-2">
            <p className="font-semibold text-2xl">Invites that need approval</p>
            <List>
              {actionable.map((request) => (
                <OnetimeInviteListItem
                  key={request.id}
                  invite={request}
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
            <div className="flex flex-col gap-y-1">
              <p className="font-semibold text-2xl">Invites to be sent</p>
              <p className="text-zinc-500">
                These invites are ready to be sent.
              </p>
            </div>
            <List>
              {unverifiableActionable.map((invite) => (
                <OnetimeInviteListItem
                  key={invite.id}
                  invite={invite}
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
            <div className="flex flex-col gap-y-1">
              <p className="font-semibold text-2xl">No action needed</p>
              <p className="text-zinc-500">
                Other members need to approve or send these invites.
              </p>
            </div>
            <List>
              {waitingForResponse.map((request) => (
                <OnetimeInviteListItem
                  key={request.id}
                  invite={request}
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
            <div className="flex flex-col gap-y-1">
              <p className="font-semibold text-2xl">Past invites</p>
              <p className="text-zinc-500">
                These invites have been accepted or rejected.
              </p>
            </div>
            <List>
              {settled.map((invite) => (
                <OnetimeInviteListItem
                  key={invite.id}
                  invite={invite}
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
    </CenterLayout>
  );
};

export default InvitesPage;
