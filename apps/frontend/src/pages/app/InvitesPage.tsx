import {
  CommunityDto,
  CreateOnetimeInviteDto,
  OnetimeInviteDto,
  RequestOnetimeInviteDto,
  userApproveOnetimeInvite,
  userCreateOnetimeInvite,
  userDeleteOnetimeInvite,
  userGetMyCommunities,
  userGetOnetimeInvitesOverview,
  userRejectOnetimeInvite,
  userRequestOnetimeInvite,
} from "@alliance/shared/client";
import Card from "@alliance/sharedweb/ui/Card";
import DropdownSelect from "@alliance/sharedweb/ui/DropdownSelect";
import List from "@alliance/sharedweb/ui/List";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../lib/AuthContext";
import { getBaseUrl } from "@alliance/sharedweb/lib/config";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { CardStyle } from "@alliance/shared/styles/card";
import TwoColumnLayout from "../../components/TwoColumnLayout";
import OnetimeInviteListItem from "../../components/OnetimeInviteListItem";
import OnetimeInviteForm from "../../components/OnetimeInviteForm";

const createdAtComparator = (
  a: { createdAt: string },
  b: { createdAt: string }
) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

const InvitesPage = () => {
  const { user } = useAuth();
  const { error: errorToast, confirm } = useToast();
  const [communities, setCommunities] = useState<CommunityDto[]>([]);
  const [communityFilter, setCommunityFilter] = useState<`c${string}` | "all">(
    "all"
  );
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [inviteeName, setInviteeName] = useState("");
  const [inviteeDescription, setInviteeDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [invites, setInvites] = useState<OnetimeInviteDto[]>([]);

  useEffect(() => {
    userGetMyCommunities().then((resp) => {
      if (resp.data) {
        setCommunities(resp.data);
      }
    });
  }, []);

  const communityById = useMemo(
    () => new Map(communities.map((community) => [community.id, community])),
    [communities]
  );
  const getCommunityById = useCallback(
    (key: `c${string}`) => communityById.get(parseInt(key.slice(1))) ?? null,
    [communityById]
  );

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

  const communityOptions = useMemo(() => {
    const options: Record<`c${string}` | "all", string> = { all: "All groups" };
    communities.forEach((community) => {
      options[`c${community.id}`] = community.name;
    });
    return options;
  }, [communities]);

  const selectedCommunity =
    communityFilter === "all" ? null : getCommunityById(communityFilter);
  const isLeaderForSelected = selectedCommunity
    ? leaderCommunityIds.has(selectedCommunity.id)
    : false;

  useEffect(() => {
    setInviteeName("");
    setInviteeDescription("");
  }, [selectedCommunity]);

  const invitesForCommunity = useMemo(() => {
    return invites.filter(
      (invite) =>
        !selectedCommunity || invite.community?.id === selectedCommunity.id
    );
  }, [selectedCommunity, invites]);

  const invitesImmediatelyActionable = useMemo(
    () =>
      invitesForCommunity
        .filter(
          (invite) =>
            invite.status === "request_pending" &&
            invite.community?.id &&
            leaderCommunityIds.has(invite.community.id)
        )
        .sort(createdAtComparator),
    [invitesForCommunity, leaderCommunityIds]
  );

  const invitesRequiresUnverifiableAction = useMemo(
    () =>
      invitesForCommunity
        .filter((invite) => invite.status === "link_unused")
        .sort(createdAtComparator),
    [invitesForCommunity]
  );

  const invitesWaitingForResponse = useMemo(
    () =>
      invitesForCommunity
        .filter(
          (invite) =>
            invite.status === "request_pending" &&
            invite.invitingUser?.id === user?.id &&
            !(
              invite.community?.id &&
              leaderCommunityIds.has(invite.community.id)
            )
        )
        .sort(createdAtComparator),
    [invitesForCommunity, leaderCommunityIds, user?.id]
  );

  const invitesSettled = useMemo(
    () =>
      invitesForCommunity
        .filter(
          (invite) =>
            invite.status === "request_rejected" ||
            invite.status === "link_used"
        )
        .sort(createdAtComparator),
    [invitesForCommunity]
  );

  const copyToClipboard = (text: string) => {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/signup?ref=${text}`;
    navigator.clipboard.writeText(url);
  };

  const handleInvite = () => {
    if (!user || !selectedCommunity) {
      return;
    }
    setCreatingInvite(true);
    const body = {
      invitee: inviteeName,
      communityId: selectedCommunity.id,
      invitingUserId: user.id,
    } satisfies CreateOnetimeInviteDto;

    userCreateOnetimeInvite({ body })
      .then((response) => {
        if (response.data) {
          setInviteeName("");
          setInvites((prev) => [response.data, ...prev]);
          setError(null);
        } else {
          setError("Failed to create invite");
        }
      })
      .finally(() => {
        setCreatingInvite(false);
      });
  };

  const handleRequestInvite = () => {
    if (!selectedCommunity) {
      return;
    }
    setCreatingInvite(true);
    const body = {
      invitee: inviteeName,
      inviteeDescription: inviteeDescription || undefined,
      communityId: selectedCommunity.id,
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

  const inviteForm = (() => {
    if (!selectedCommunity) {
      return (
        <Card style={CardStyle.Grey}>
          <div className="flex flex-col gap-y-2">
            <p className="font-semibold">Choose a group to get started</p>
            <p className="text-zinc-500">
              Select a group above to create or request an invite.
            </p>
          </div>
        </Card>
      );
    }

    if (isLeaderForSelected) {
      return (
        <OnetimeInviteForm
          inviteeName={inviteeName}
          setInviteeName={setInviteeName}
          creatingInvite={creatingInvite}
          onCreateInvite={handleInvite}
          isLeader={true}
        />
      );
    }

    return (
      <OnetimeInviteForm
        inviteeName={inviteeName}
        setInviteeName={setInviteeName}
        inviteeDescription={inviteeDescription}
        setInviteeDescription={setInviteeDescription}
        creatingInvite={creatingInvite}
        onRequestInvite={handleRequestInvite}
        isLeader={false}
      />
    );
  })();

  return (
    <TwoColumnLayout
      main={
        <div className="p-5 xl:p-10 xl:pr-5 max-w-[900px] mx-auto px-0 md:px-3">
          <div className="flex flex-col gap-y-8 py-6 px-5 md:px-0">
            <div className="flex flex-col gap-y-3">
              <p className="font-semibold text-2xl md:text-3xl">Invites</p>
              <DropdownSelect
                options={communityOptions}
                value={communityOptions[communityFilter]}
                onChange={([key]) => setCommunityFilter(key)}
              />
              {inviteForm}
              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>

            {invitesImmediatelyActionable.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <p className="font-semibold text-xl">Invites to be approved</p>
                <List>
                  {invitesImmediatelyActionable.map((request) => (
                    <OnetimeInviteListItem
                      key={request.id}
                      invite={request}
                      showOnetimeInviteLabel={false}
                      showCommunityLabel={communityFilter === "all"}
                      communityLabel={request.community?.name}
                      selfInvited={user.id === request.invitingUser?.id}
                      onApprove={handleApproveInvite}
                      onReject={handleRejectInvite}
                    />
                  ))}
                </List>
              </div>
            )}

            {invitesRequiresUnverifiableAction.length > 0 && (
              <div className="flex flex-col gap-y-2">
                <p className="font-semibold text-xl">Invites to be sent</p>
                <List>
                  {invitesRequiresUnverifiableAction.map((invite) => (
                    <OnetimeInviteListItem
                      key={invite.id}
                      invite={invite}
                      showOnetimeInviteLabel={false}
                      showCommunityLabel={communityFilter === "all"}
                      communityLabel={invite.community?.name}
                      selfInvited={user.id === invite.invitingUser?.id}
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
                      showOnetimeInviteLabel={false}
                      showCommunityLabel={communityFilter === "all"}
                      communityLabel={request.community?.name}
                      selfInvited={user.id === request.invitingUser?.id}
                      onDelete={(inviteId) => handleDeleteRequest(inviteId)}
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
                      showOnetimeInviteLabel={false}
                      showCommunityLabel={communityFilter === "all"}
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
