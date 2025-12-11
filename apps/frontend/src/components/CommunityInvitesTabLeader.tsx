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
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/AuthContext";
import List from "@alliance/shared/ui/List";
import { getBaseUrl } from "@alliance/shared/lib/config";
import UserSelect, {
  UserSelectUser,
  useSelectableUserIds,
} from "@alliance/shared/ui/UserSelect";
import DropdownSelect from "@alliance/shared/ui/DropdownSelect";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import CommunityInviteListItem from "./CommunityInviteListItem";
import { Link } from "react-router";
import OneTimeInviteRequestLeaderListItem from "./OneTimeInviteRequestLeaderListItem";
import OneTimeInviteLeaderListItem from "./OneTimeInviteLeaderListItem";
import { useToast } from "@alliance/shared/ui/ToastProvider";

export interface CommunityInvitesTabLeaderProps {
  communityId: number;
  existingMembers: ProfileDto[];
  setInviteNotifCount: (count: number) => void;
}

export enum InviteMode {
  NewMember = "New Alliance member",
  CurrentMember = "Current Alliance member",
}

const CommunityInvitesTabLeader = ({
  communityId,
  existingMembers,
  setInviteNotifCount,
}: CommunityInvitesTabLeaderProps) => {
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
            .filter((invite) => invite.status === "pending")
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
          setNewUserInvites(response.data);
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
    userGetOnetimeInvitesByCommunity({ path: { communityId } }).then(
      (response) => {
        if (response.data) {
          setPendingRequests(
            response.data
              .filter((request) => request.status === "request_pending")
              .sort(
                (a, b) =>
                  new Date(b.createdAt).getTime() -
                  new Date(a.createdAt).getTime()
              )
          );
        } else {
          setError("Failed to load new member requests");
        }
      }
    );
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
          console.log("Invite created", response.data);
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
        if (response.data) {
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
    <div className="flex flex-col gap-y-8 py-4">
      <div className="flex flex-col gap-y-3">
        <p className="font-semibold text-xl md:text-2xl">
          Invite someone to your group
        </p>
        <DropdownSelect
          options={Object.values(InviteMode)}
          value={inviteMode}
          onChange={(mode) => setInviteMode(mode as InviteMode)}
        />

        {inviteMode === InviteMode.NewMember ? (
          <Card style={CardStyle.Grey}>
            <div className="flex flex-col gap-y-2">
              <p className="font-semibold">
                Invite a new member to the Alliance and your group
              </p>
              <p className="text-zinc-500">
                This will create a personalized invite page that explains the
                Alliance and how to sign up.
              </p>
              <p className="text-zinc-500">
                When the new member signs up, they will automatically be added
                to your group.
              </p>
              <Link
                to="/groups?tab=resources"
                className="text-green hover:underline"
              >
                Invite guide
              </Link>
              <div className="flex flex-row gap-x-2 mt-2">
                <input
                  type="text"
                  className="border border-zinc-300 rounded px-3 h-10 flex-1"
                  placeholder="Enter the invitee's first name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Button
                  color={ButtonColor.Black}
                  onClick={handleInvite}
                  className="!h-10"
                  disabled={creatingInvite || !name}
                >
                  {creatingInvite ? "Creating invite..." : "Create invite"}
                </Button>
              </div>
            </div>
          </Card>
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
              <OneTimeInviteRequestLeaderListItem
                key={request.id}
                request={request}
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
              switch (entry.type) {
                case "new_member":
                  return (
                    <OneTimeInviteLeaderListItem
                      key={entry.data.id}
                      leaderId={user?.id}
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

export default CommunityInvitesTabLeader;
