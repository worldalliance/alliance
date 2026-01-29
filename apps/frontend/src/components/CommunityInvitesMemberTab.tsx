import {
  OnetimeInviteDto,
  RequestOnetimeInviteDto,
  userDeleteOnetimeInvite,
  userGetOnetimeInvitesOverview,
  userRequestOnetimeInvite,
} from "@alliance/shared/client";
import { getBaseUrl } from "@alliance/sharedweb/lib/config";
import List from "@alliance/sharedweb/ui/List";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import OnetimeInviteListItem from "./OnetimeInviteListItem";
import OnetimeInviteForm from "./OnetimeInviteForm";

function createdAtComparator(
  a: { createdAt: string },
  b: { createdAt: string }
) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

type CommunityInvitesMemberTabProps = {
  communityId: number;
};

const CommunityInvitesMemberTab = ({
  communityId,
}: CommunityInvitesMemberTabProps) => {
  const { user } = useAuth();
  const { error: errorToast, confirm } = useToast();

  const [loadingInvites, setLoadingInvites] = useState(true);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [inviteeName, setInviteeName] = useState("");
  const [inviteeDescription, setInviteeDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [invites, setInvites] = useState<OnetimeInviteDto[]>([]);

  useEffect(() => {
    if (!user) {
      return;
    }
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
  }, [user]);

  const myInvitesForCommunity = useMemo(() => {
    if (!user) {
      return [];
    }
    return invites.filter(
      (invite) =>
        invite.community?.id === communityId &&
        invite.invitingUser?.id === user.id
    );
  }, [communityId, invites, user]);

  const invitesRequiresUnverifiableAction = useMemo(
    () =>
      myInvitesForCommunity
        .filter((invite) => invite.status === "link_unused")
        .sort(createdAtComparator),
    [myInvitesForCommunity]
  );

  const invitesWaitingForResponse = useMemo(
    () =>
      myInvitesForCommunity
        .filter((invite) => invite.status === "request_pending")
        .sort(createdAtComparator),
    [myInvitesForCommunity]
  );

  const invitesSettled = useMemo(
    () =>
      myInvitesForCommunity
        .filter(
          (invite) =>
            invite.status === "request_rejected" ||
            invite.status === "link_used"
        )
        .sort(createdAtComparator),
    [myInvitesForCommunity]
  );

  const copyToClipboard = (code: string) => {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/signup?ref=${code}`;
    navigator.clipboard.writeText(url);
  };

  const handleRequestInvite = () => {
    if (!user) {
      return;
    }
    setCreatingInvite(true);
    const body = {
      invitee: inviteeName,
      inviteeDescription: inviteeDescription || undefined,
      communityId,
    } satisfies RequestOnetimeInviteDto;

    void (async () => {
      const response = await userRequestOnetimeInvite({ body });
      if (response.data) {
        setInviteeName("");
        setInviteeDescription("");
        setInvites((prev) => [response.data, ...prev]);
        setError(null);
      } else {
        setError("Failed to request invite");
      }
      setCreatingInvite(false);
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

  const handleCancelRequest = (inviteId: number) => {
    void (async () => {
      const response = await userDeleteOnetimeInvite({ path: { inviteId } });
      if (!response.error) {
        setInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
      } else {
        errorToast("Failed to cancel invite request");
      }
    })();
  };

  if (!user || loadingInvites) {
    return <Spinner />;
  }

  return (
    <div className="flex flex-col gap-y-8 py-4 px-2 md:px-0">
      <div className="flex flex-col gap-y-3">
        <p className="font-semibold text-xl md:text-2xl">Request an invite</p>
        <OnetimeInviteForm
          inviteeName={inviteeName}
          setInviteeName={setInviteeName}
          inviteeDescription={inviteeDescription}
          setInviteeDescription={setInviteeDescription}
          creatingInvite={creatingInvite}
          onRequestInvite={handleRequestInvite}
          isLeader={false}
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>

      {invitesRequiresUnverifiableAction.length > 0 && (
        <div className="flex flex-col gap-y-2">
          <p className="font-semibold text-xl">Invites to be sent</p>
          <List>
            {invitesRequiresUnverifiableAction.map((invite) => (
              <OnetimeInviteListItem
                key={invite.id}
                invite={invite}
                selfInvited={true}
                onDelete={handleDeleteInvite}
                onCopy={copyToClipboard}
              />
            ))}
          </List>
        </div>
      )}

      {invitesWaitingForResponse.length > 0 && (
        <div className="flex flex-col gap-y-2">
          <p className="font-semibold text-xl">Waiting on response</p>
          <List>
            {invitesWaitingForResponse.map((request) => (
              <OnetimeInviteListItem
                key={request.id}
                invite={request}
                selfInvited={true}
                onDelete={handleCancelRequest}
              />
            ))}
          </List>
        </div>
      )}

      {invitesSettled.length > 0 && (
        <div className="flex flex-col gap-y-2">
          <p className="font-semibold text-xl">Past invites</p>
          <List>
            {invitesSettled.map((invite) => (
              <OnetimeInviteListItem
                key={invite.id}
                invite={invite}
                selfInvited={true}
                onCopy={copyToClipboard}
              />
            ))}
          </List>
        </div>
      )}
    </div>
  );
};

export default CommunityInvitesMemberTab;
