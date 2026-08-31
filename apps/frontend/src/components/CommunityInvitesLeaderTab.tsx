import { errorMessage } from "@alliance/common/errorMessage";
import {
  communityCreateCommunityInvite,
  communityDeleteCommunityInvite,
  communityGetCommunityInvites,
  CommunityInviteDto,
  CreateOnetimeInviteDto,
  ProfileDto,
} from "@alliance/shared/client";
import {
  deleteInviteConfirmation,
  inviteBuckets,
  onetimeInviteCreation,
} from "@alliance/shared/lib/copy";
import { getOnetimeInviteSignupUrl } from "@alliance/shared/lib/inviteUrls";
import {
  bucketCommunityInvitesByActionability,
  bucketOnetimeInvitesByActionability,
} from "@alliance/shared/lib/inviteUtils";
import { useCommunityOnetimeInvites } from "@alliance/shared/lib/useCommunityOnetimeInvites";
import { CardStyle } from "@alliance/shared/styles/card";
import { getInviteBaseUrl } from "@alliance/sharedweb/lib/config";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import DropdownSelect from "@alliance/sharedweb/ui/DropdownSelect";
import List from "@alliance/sharedweb/ui/List";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import UserSelect, {
  UserSelectUser,
  useSelectableUserIds,
} from "@alliance/sharedweb/ui/UserSelect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import CommunityInviteListItem from "./CommunityInviteListItem";
import OnetimeInviteForm from "./OnetimeInviteForm";
import OnetimeInviteListItem from "./OnetimeInviteListItem";

export interface CommunityInvitesLeaderTabProps {
  communityId: number;
  existingMembers: ProfileDto[];
  setInviteNotifCount: (count: number) => void;
}

export enum InviteMode {
  NewMember = "New Alliance member",
  CurrentMember = "Current Alliance member",
}

const CommunityInvitesLeaderTab = ({
  communityId,
  existingMembers,
  setInviteNotifCount,
}: CommunityInvitesLeaderTabProps) => {
  const [name, setName] = useState("");
  const { user } = useAuth();

  const [creatingInvite, setCreatingInvite] = useState(false);

  const {
    invites: onetimeInvites,
    isError: onetimeInvitesError,
    createInvite,
    approveInvite,
    rejectInvite,
    deleteInvite,
  } = useCommunityOnetimeInvites(communityId);
  const [communityInvites, setCommunityInvites] = useState<
    CommunityInviteDto[]
  >([]);
  const [copiedInviteId, setCopiedInviteId] = useState<number | null>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { error: errorToast, confirm } = useToast();

  const allUsers = useSelectableUserIds();

  const selectableUsers = useMemo(
    () =>
      allUsers.filter(
        (user) =>
          !existingMembers.some((member) => member.id === user.id) &&
          !communityInvites
            .filter((invite) => invite.status === "invitee_pending")
            .some((invite) => invite.invitedUser?.id === user.id),
      ),
    [allUsers, existingMembers, communityInvites],
  );

  const [selectedUser, setSelectedUser] = useState<UserSelectUser | null>(null);

  const [inviteMode, setInviteMode] = useState<InviteMode>(
    InviteMode.NewMember,
  );

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    communityGetCommunityInvites({ path: { communityId } }).then((response) => {
      if (response.data) {
        setCommunityInvites(response.data);
      } else {
        setError("Failed to load existing member invites");
      }
    });
  }, [communityId]);

  const leaderCommunityIds = useMemo(() => {
    return new Set([communityId]);
  }, [communityId]);

  const {
    actionable: onetimeActionable,
    unverifiableActionable: onetimeUnverifiableActionable,
    waitingForResponse: onetimeWaitingForResponse,
    settled: onetimeSettled,
  } = useMemo(() => {
    if (!user) {
      return {
        actionable: [],
        unverifiableActionable: [],
        waitingForResponse: [],
        settled: [],
      };
    }
    return bucketOnetimeInvitesByActionability({
      invites: onetimeInvites,
      leaderCommunityIds,
      userId: user.id,
    });
  }, [onetimeInvites, leaderCommunityIds, user]);

  const {
    actionable: communityActionable,
    waitingForResponse: communityWaitingForResponse,
    settled: communitySettled,
  } = useMemo(() => {
    if (!user) {
      return {
        actionable: [],
        waitingForResponse: [],
        settled: [],
      };
    }
    return bucketCommunityInvitesByActionability({
      invites: communityInvites,
      userId: user.id,
    });
  }, [communityInvites, user]);

  useEffect(() => {
    setInviteNotifCount(onetimeActionable.length);
  }, [onetimeActionable.length, setInviteNotifCount]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(
      getOnetimeInviteSignupUrl(getInviteBaseUrl(), text),
    );
  }, []);

  const handleCopied = useCallback((inviteId: number) => {
    if (copiedTimeoutRef.current) {
      clearTimeout(copiedTimeoutRef.current);
    }
    setCopiedInviteId(inviteId);
    copiedTimeoutRef.current = setTimeout(() => {
      setCopiedInviteId(null);
      copiedTimeoutRef.current = null;
    }, 2000);
  }, []);

  const handleInvite = () => {
    if (!user) {
      return;
    }
    setCreatingInvite(true);
    const body = {
      invitee: name,
      communityId,
      invitingUserId: user.id,
    } satisfies CreateOnetimeInviteDto;

    createInvite(body)
      .then(() => {
        setName("");
        setError(null);
      })
      .catch(() => {
        setError("Failed to create invite");
      })
      .finally(() => {
        setCreatingInvite(false);
      });
  };

  const handleInviteExistingMember = () => {
    if (!selectedUser) {
      return;
    }
    setCreatingInvite(true);
    communityCreateCommunityInvite({
      body: { invitedUserId: selectedUser.id, communityId },
    })
      .then((response) => {
        if (response.data) {
          setCommunityInvites((prev) => [response.data, ...prev]);
          setSelectedUser(null);
          setError(null);
        } else {
          setError(
            errorMessage({
              error: response.error,
              fallback: "Failed to invite user",
            }),
          );
        }
      })
      .finally(() => {
        setCreatingInvite(false);
      });
  };

  const onApproveOnetimeInvite = (inviteId: number) => {
    approveInvite(inviteId).catch(() => {
      errorToast("Failed to approve invite");
    });
  };

  const onRejectOnetimeInvite = (inviteId: number) => {
    rejectInvite(inviteId).catch(() => {
      errorToast("Failed to reject invite");
    });
  };

  const handleDeleteInvite = (
    inviteId: number,
    event: React.MouseEvent<HTMLElement>,
  ) => {
    void (async () => {
      const ok = await confirm({
        message: deleteInviteConfirmation.message,
        confirmLabel: deleteInviteConfirmation.confirmLabel,
        cancelLabel: deleteInviteConfirmation.cancelLabel,
        anchorEl: event.currentTarget,
        placement: "topleft",
      });
      if (!ok) {
        return;
      }

      deleteInvite(inviteId).catch(() => {
        errorToast("Failed to delete invite");
      });
    })();
  };

  const handleDeleteCommunityInvite = (inviteId: number) => {
    communityDeleteCommunityInvite({ path: { inviteId } }).then((response) => {
      if (response.data) {
        setCommunityInvites((prev) =>
          prev.filter((invite) => invite.id !== inviteId),
        );
      }
    });
  };

  return (
    <div className="flex flex-col gap-y-8 py-4 px-2 md:px-0">
      <div className="flex flex-col gap-y-3">
        <p className="font-semibold text-xl md:text-2xl">
          Invite someone to your group
        </p>
        <DropdownSelect
          options={InviteMode}
          value={inviteMode}
          onChange={([, mode]) => setInviteMode(mode)}
        />

        {inviteMode === InviteMode.NewMember ? (
          <Card style={CardStyle.White}>
            <OnetimeInviteForm
              title={onetimeInviteCreation.responsible.leader.invite.title}
              explanation={
                onetimeInviteCreation.responsible.leader.invite.explanation
              }
              inviteeName={name}
              setInviteeName={setName}
              onSubmit={handleInvite}
              creatingInvite={creatingInvite}
            />
          </Card>
        ) : (
          <Card style={CardStyle.White}>
            <div className="flex flex-col gap-y-4">
              <div className="flex flex-col gap-y-2">
                <p className="text-xl font-semibold text-zinc-900">
                  Invite a current member to your group
                </p>
                <p className="text-invite-form-body">
                  The member will receive a notification inviting them to join
                  the group.
                </p>
              </div>
              <div className="flex flex-col gap-y-4">
                <UserSelect
                  users={selectableUsers}
                  selectedUserIds={selectedUser?.id ? [selectedUser.id] : []}
                  onChange={(userIds) =>
                    setSelectedUser(
                      selectableUsers.find((user) => user.id === userIds[0]) ??
                        null,
                    )
                  }
                  label={null}
                  single={true}
                />
                <Button
                  color={ButtonColor.Black}
                  onClick={handleInviteExistingMember}
                  disabled={creatingInvite || !selectedUser}
                  className="w-full"
                >
                  {creatingInvite ? "Creating invite..." : "Create invite"}
                </Button>
              </div>
            </div>
          </Card>
        )}
        {onetimeInvitesError && (
          <p className="text-red-500 text-sm">
            Failed to load new member invites
          </p>
        )}
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>

      {onetimeActionable.length > 0 && (
        <div className="flex flex-col gap-y-2">
          <p className="font-semibold text-xl">
            {inviteBuckets.actionable.title}
          </p>
          <List>
            {onetimeActionable.map((request) => (
              <OnetimeInviteListItem
                key={request.id}
                invite={request}
                selfInvited={!!(user && user.id === request.invitingUser?.id)}
                onApprove={onApproveOnetimeInvite}
                onReject={onRejectOnetimeInvite}
              />
            ))}
          </List>
        </div>
      )}

      {communityActionable.length > 0 && (
        <div className="flex flex-col gap-y-2">
          <p className="font-semibold text-xl">
            {inviteBuckets.actionable.title}
          </p>
          <List>
            {communityActionable.map((invite) => (
              <CommunityInviteListItem
                key={invite.id}
                invite={invite}
                selfInvited={!!(user && user.id === invite.invitingUser?.id)}
                onDelete={handleDeleteCommunityInvite}
              />
            ))}
          </List>
        </div>
      )}

      {onetimeUnverifiableActionable.length > 0 && (
        <div className="flex flex-col gap-y-2">
          <div className="flex flex-col gap-y-1">
            <p className="font-semibold text-xl">
              {inviteBuckets.unverifiableActionable.title}
            </p>
            <p className="text-zinc-500">
              {inviteBuckets.unverifiableActionable.description}
            </p>
          </div>
          <List>
            {onetimeUnverifiableActionable.map((invite) => (
              <OnetimeInviteListItem
                key={invite.id}
                invite={invite}
                selfInvited={!!(user && user.id === invite.invitingUser?.id)}
                copied={copiedInviteId === invite.id}
                onDelete={handleDeleteInvite}
                onCopy={copyToClipboard}
                onCopied={handleCopied}
              />
            ))}
          </List>
        </div>
      )}

      {(onetimeWaitingForResponse.length > 0 ||
        communityWaitingForResponse.length > 0) && (
        <div className="flex flex-col gap-y-2">
          <div className="flex flex-col gap-y-1">
            <p className="font-semibold text-xl">
              {inviteBuckets.waitingForResponse.title}
            </p>
            <p className="text-zinc-500">
              {inviteBuckets.waitingForResponse.description}
            </p>
          </div>
          <List>
            {onetimeWaitingForResponse.map((request) => (
              <OnetimeInviteListItem
                key={request.id}
                invite={request}
                selfInvited={!!(user && user.id === request.invitingUser?.id)}
                onDelete={handleDeleteInvite}
              />
            ))}
            {communityWaitingForResponse.map((invite) => (
              <CommunityInviteListItem
                key={invite.id}
                invite={invite}
                selfInvited={!!(user && user.id === invite.invitingUser?.id)}
                onDelete={handleDeleteCommunityInvite}
              />
            ))}
          </List>
        </div>
      )}

      {(onetimeSettled.length > 0 || communitySettled.length > 0) && (
        <div className="flex flex-col gap-y-2">
          <div className="flex flex-col gap-y-1">
            <p className="font-semibold text-xl">
              {inviteBuckets.settled.title}
            </p>
            <p className="text-zinc-500">{inviteBuckets.settled.description}</p>
          </div>
          <List>
            {onetimeSettled.map((invite) => (
              <OnetimeInviteListItem
                key={invite.id}
                invite={invite}
                selfInvited={!!(user && user.id === invite.invitingUser?.id)}
                copied={copiedInviteId === invite.id}
                onCopy={copyToClipboard}
                onCopied={handleCopied}
              />
            ))}
            {communitySettled.map((invite) => (
              <CommunityInviteListItem
                key={invite.id}
                invite={invite}
                selfInvited={!!(user && user.id === invite.invitingUser?.id)}
              />
            ))}
          </List>
        </div>
      )}
    </div>
  );
};

export default CommunityInvitesLeaderTab;
