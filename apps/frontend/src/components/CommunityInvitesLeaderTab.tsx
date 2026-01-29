import {
  CommunityInviteDto,
  CreateOnetimeInviteDto,
  OnetimeInviteDto,
  ProfileDto,
  userCreateCommunityInvite,
  userCreateOnetimeInvite,
  userDeleteCommunityInvite,
  userDeleteOnetimeInvite,
  userGetCommunityInvites,
  userGetOnetimeInvitesByCommunity,
  userApproveOnetimeInvite,
  userRejectOnetimeInvite,
} from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import List from "@alliance/sharedweb/ui/List";
import { getBaseUrl } from "@alliance/sharedweb/lib/config";
import UserSelect, {
  UserSelectUser,
  useSelectableUserIds,
} from "@alliance/sharedweb/ui/UserSelect";
import DropdownSelect from "@alliance/sharedweb/ui/DropdownSelect";
import Card from "@alliance/sharedweb/ui/Card";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { CardStyle } from "@alliance/shared/styles/card";
import CommunityInviteListItem from "./CommunityInviteListItem";
import OnetimeInviteListItem from "./OnetimeInviteListItem";
import OnetimeInviteForm from "./OnetimeInviteForm";

export interface CommunityInvitesLeaderTabProps {
  communityId: number;
  existingMembers: ProfileDto[];
  setInviteNotifCount: (count: number) => void;
}

export enum InviteMode {
  NewMember = "New Alliance member",
  CurrentMember = "Current Alliance member",
}

function createdAtComparator(
  a: { createdAt: string },
  b: { createdAt: string }
) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

const CommunityInvitesLeaderTab = ({
  communityId,
  existingMembers,
  setInviteNotifCount,
}: CommunityInvitesLeaderTabProps) => {
  const [name, setName] = useState("");
  const { user } = useAuth();

  const [creatingInvite, setCreatingInvite] = useState(false);

  const [pendingRequests, setPendingRequests] = useState<OnetimeInviteDto[]>(
    []
  );

  const [newUserInvites, setNewUserInvites] = useState<OnetimeInviteDto[]>([]);
  const [existingMemberInvites, setExistingMemberInvites] = useState<
    CommunityInviteDto[]
  >([]);
  const { error: errorToast, confirm } = useToast();

  const allUsers = useSelectableUserIds();

  const selectableUsers = useMemo(
    () =>
      allUsers.filter(
        (user) =>
          !existingMembers.some((member) => member.id === user.id) &&
          !existingMemberInvites
            .filter((invite) => invite.status === "invitee_pending")
            .some((invite) => invite.invitedUser?.id === user.id)
      ),
    [allUsers, existingMembers, existingMemberInvites]
  );

  const [selectedUser, setSelectedUser] = useState<UserSelectUser | null>(null);

  const [inviteMode, setInviteMode] = useState<InviteMode>(
    InviteMode.NewMember
  );

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    userGetOnetimeInvitesByCommunity({ path: { communityId } }).then(
      (response) => {
        if (response.data) {
          setNewUserInvites(
            response.data
              .filter(
                (invite) =>
                  invite.status === "link_unused" ||
                  invite.status === "link_used"
              )
              .sort(createdAtComparator)
          );
          setPendingRequests(
            response.data
              .filter((invite) => invite.status === "request_pending")
              .sort(createdAtComparator)
          );
        } else {
          setError("Failed to load new member invites");
        }
      }
    );
    userGetCommunityInvites({ path: { communityId } }).then((response) => {
      if (response.data) {
        setExistingMemberInvites(response.data);
      } else {
        setError("Failed to load existing member invites");
      }
    });
  }, [communityId]);

  useEffect(() => {
    setInviteNotifCount(pendingRequests.length);
  }, [pendingRequests, setInviteNotifCount]);

  const copyToClipboard = (text: string) => {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/signup?ref=${text}`;
    navigator.clipboard.writeText(url);
  };

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

    userCreateOnetimeInvite({ body })
      .then((response) => {
        if (response.data) {
          setName("");
          setNewUserInvites((prev) => [response.data, ...prev]);
          setError(null);
        }
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
    userCreateCommunityInvite({
      body: { invitedUserId: selectedUser.id, communityId },
    })
      .then((response) => {
        if (response.data) {
          setExistingMemberInvites((prev) => [response.data, ...prev]);
          setSelectedUser(null);
          setError(null);
        } else {
          setError(
            (response.error as Error).message ?? "Failed to invite user"
          );
        }
      })
      .finally(() => {
        setCreatingInvite(false);
      });
  };

  const onApproveOnetimeInvite = (inviteId: number) => {
    (async () => {
      const response = await userApproveOnetimeInvite({
        path: { inviteId },
      });
      if (!response.data) {
        errorToast(`Failed to approve invite: ${response.response.statusText}`);
        return;
      }

      setPendingRequests((prev) =>
        prev.filter((request) => request.id !== inviteId)
      );
      setNewUserInvites((prev) => [...prev, response.data]);
    })();
  };

  const onRejectOnetimeInvite = (inviteId: number) => {
    (async () => {
      const response = await userRejectOnetimeInvite({
        path: { inviteId },
      });

      if (response.error) {
        errorToast(`Failed to reject invite: ${response.response.statusText}`);
        return;
      }

      setPendingRequests((prev) =>
        prev.filter((request) => request.id !== inviteId)
      );
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

      userDeleteOnetimeInvite({ path: { inviteId } }).then((response) => {
        if (!response.error) {
          setNewUserInvites((prev) =>
            prev.filter((invite) => invite.id !== inviteId)
          );
        }
      });
    })();
  };

  const handleDeleteCommunityInvite = (inviteId: number) => {
    userDeleteCommunityInvite({ path: { inviteId } }).then((response) => {
      if (response.data) {
        setExistingMemberInvites((prev) =>
          prev.filter((invite) => invite.id !== inviteId)
        );
      }
    });
  };

  const combinedPastInvites = useMemo(() => {
    return [
      ...newUserInvites.map((invite) => ({
        type: "new_member" as const,
        data: invite,
      })),
      ...existingMemberInvites.map((invite) => ({
        type: "existing_member" as const,
        data: invite,
      })),
    ].sort((a, b) => {
      return (
        new Date(b.data.createdAt).getTime() -
        new Date(a.data.createdAt).getTime()
      );
    });
  }, [newUserInvites, existingMemberInvites]);

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
          <OnetimeInviteForm
            inviteeName={name}
            setInviteeName={setName}
            creatingInvite={creatingInvite}
            onCreateInvite={handleInvite}
            isLeader={true}
          />
        ) : (
          <Card style={CardStyle.Grey}>
            <div className="flex flex-col gap-y-2">
              <p className="font-semibold">
                Invite an existing Alliance member to your group
              </p>
              <p className="text-zinc-500">
                The member will recieve a notification inviting them to join the
                group.
              </p>
              <div className="flex flex-row gap-x-2 mt-2">
                <div className="flex-1">
                  <UserSelect
                    users={selectableUsers}
                    selectedUserIds={selectedUser?.id ? [selectedUser.id] : []}
                    onChange={(userIds) =>
                      setSelectedUser(
                        selectableUsers.find(
                          (user) => user.id === userIds[0]
                        ) ?? null
                      )
                    }
                    label={null}
                    single={true}
                  />
                </div>
              </div>
              <Button
                color={ButtonColor.Black}
                onClick={handleInviteExistingMember}
                disabled={creatingInvite || !selectedUser}
              >
                {creatingInvite ? "Creating invite..." : "Invite"}
              </Button>
            </div>
          </Card>
        )}
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>

      {pendingRequests.length > 0 && (
        <div className="flex flex-col gap-y-2">
          <p className="font-semibold text-xl">Invite requests</p>
          <List>
            {pendingRequests.map((request) => (
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

      {combinedPastInvites.length > 0 && (
        <div className="flex flex-col gap-y-2">
          <p className="font-semibold text-xl">Past invites</p>
          <List>
            {combinedPastInvites.map((entry) => {
              const selfInvited = !!(
                user && user.id === entry.data.invitingUser?.id
              );
              switch (entry.type) {
                case "new_member":
                  return (
                    <OnetimeInviteListItem
                      key={entry.data.id}
                      selfInvited={selfInvited}
                      invite={entry.data}
                      onDelete={handleDeleteInvite}
                      onCopy={copyToClipboard}
                    />
                  );
                case "existing_member":
                  return (
                    <CommunityInviteListItem
                      key={entry.data.id}
                      invite={entry.data}
                      selfInvited={selfInvited}
                      onDelete={handleDeleteCommunityInvite}
                    />
                  );
                default:
                  entry satisfies never;
              }
            })}
          </List>
        </div>
      )}
    </div>
  );
};

export default CommunityInvitesLeaderTab;
