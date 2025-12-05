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
  userGetOnetimeInviteRequestsByCommunity,
  OnetimeInviteRequestDto,
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
import OneTimeInviteListItem from "./OneTimeInviteListItem";
import CommunityInviteListItem from "./CommunityInviteListItem";
import { Link } from "react-router";
import OneTimeInviteRequestListItem from "./OneTimeInviteRequestListItem";

export interface CommunityInvitesTabLeaderProps {
  communityId: number;
  existingMembers: ProfileDto[];
}

export enum InviteMode {
  NewMember = "New Alliance member",
  CurrentMember = "Current Alliance member",
}

const CommunityInvitesTabLeader = ({
  communityId,
  existingMembers,
}: CommunityInvitesTabLeaderProps) => {
  const [name, setName] = useState("");
  const { user } = useAuth();

  const [creatingInvite, setCreatingInvite] = useState(false);

  const [newUserInviteRequests, setNewUserInviteRequests] = useState<
    OnetimeInviteRequestDto[]
  >([]);

  const [newUserPastInvites, setNewUserPastInvites] = useState<
    OnetimeInviteDto[]
  >([]);
  const [existingMemberInvites, setExistingMemberInvites] = useState<
    CommunityInviteDto[]
  >([]);

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
          setNewUserPastInvites(response.data);
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
    userGetOnetimeInviteRequestsByCommunity({ path: { communityId } }).then(
      (response) => {
        if (response.data) {
          setNewUserInviteRequests(response.data);
        } else {
          setError("Failed to load new member requests");
        }
      }
    );
  }, [communityId]);

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
          setNewUserPastInvites((prev) => [response.data, ...prev]);
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

  const handleDeleteInvite = (inviteId: number) => {
    userDeleteOnetimeInvite({ path: { inviteId } }).then((response) => {
      if (response.data) {
        setNewUserPastInvites((prev) =>
          prev.filter((invite) => invite.id !== inviteId)
        );
      }
    });
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
    return [...newUserPastInvites, ...existingMemberInvites].sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [newUserPastInvites, existingMemberInvites]);
  useMemo(
    () =>
      newUserInviteRequests.sort((a, b) => {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }),
    [newUserInviteRequests]
  );

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

      <div className="flex flex-col gap-y-2">
        <p className="font-semibold text-xl">Invite requests</p>
        <List>
          {newUserInviteRequests.map((request) => (
            <OneTimeInviteRequestListItem
              key={request.id}
              request={request}
              isLeader={true}
              onApprove={() => {
                /* TODO asdf */
              }}
              onReject={() => {
                /* TODO asdf */
              }}
            />
          ))}
        </List>
      </div>

      <div className="flex flex-col gap-y-2">
        <p className="font-semibold text-xl">Past invites</p>
        <List>
          {combinedPastInvites.map((invite) =>
            "invitee" in invite ? (
              <OneTimeInviteListItem
                key={invite.id}
                invite={invite}
                onDelete={handleDeleteInvite}
                onCopy={copyToClipboard}
              />
            ) : (
              <CommunityInviteListItem
                key={invite.id}
                invite={invite}
                onDelete={handleDeleteCommunityInvite}
              />
            )
          )}
        </List>
      </div>
    </div>
  );
};

export default CommunityInvitesTabLeader;
