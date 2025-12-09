import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import { useEffect, useMemo, useState } from "react";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import { useAuth } from "../lib/AuthContext";
import {
  CreateOnetimeInviteRequestDto,
  OnetimeInviteDto,
  OnetimeInviteRequestDto,
  userCreateOnetimeInviteRequest,
  userDeleteOnetimeInvite,
  userDeleteOnetimeInviteRequest,
  userGetOnetimeInviteRequestsByRequester,
  userGetOnetimeInvitesByRequester,
} from "@alliance/shared/client";
import List from "@alliance/shared/ui/List";
import OneTimeInviteRequestListItem from "./OneTimeInviteRequestListItem";
import { useToast } from "@alliance/shared/ui/ToastProvider";
import OneTimeInviteListItem from "./OneTimeInviteListItem";
import { getBaseUrl } from "@alliance/shared/lib/config";

export interface CommunityInvitesTabMemberProps {
  communityId: number;
}

const CommunityInvitesTabMember = ({
  communityId,
}: CommunityInvitesTabMemberProps) => {
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [inviteeName, setInviteeName] = useState("");
  const [inviteeDescription, setInviteeDescription] = useState("");
  const [creatingRequest, setCreatingInvite] = useState(false);
  const [requests, setRequests] = useState<OnetimeInviteRequestDto[]>([]);
  const { error: errorToast } = useToast();
  const [invites, setInvites] = useState<OnetimeInviteDto[]>([]);

  useEffect(() => {
    userGetOnetimeInviteRequestsByRequester({ path: { communityId } }).then(
      (response) => {
        if (response.data) {
          setRequests(
            response.data.sort(
              (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            )
          );
        } else {
          setError("Failed to load new member invites");
        }
      }
    );
    userGetOnetimeInvitesByRequester({ path: { communityId } }).then(
      (response) => {
        if (response.data) {
          setInvites(response.data);
        } else {
          setError("Failed to load new member invites");
        }
      }
    );
  }, [communityId]);

  const copyToClipboard = (text: string) => {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/signup?ref=${text}`;
    navigator.clipboard.writeText(url);
  };

  const handleDeleteInvite = (inviteId: number) => {
    userDeleteOnetimeInvite({ path: { inviteId } }).then((response) => {
      if (response.data) {
        setInvites((prev) => prev.filter((invite) => invite.id !== inviteId));
      }
    });
  };

  const handleRequest = () => {
    if (!user) {
      return;
    }
    setCreatingInvite(true);
    const body = {
      invitee: inviteeName,
      inviteeDescription,
      communityId,
      invitingUserId: user.id,
    } satisfies CreateOnetimeInviteRequestDto;

    userCreateOnetimeInviteRequest({ body })
      .then((response) => {
        if (response.data) {
          setInviteeName("");
          setInviteeDescription("");
          setRequests((prev) => [response.data, ...prev]);
          setError(null);
        }
      })
      .finally(() => {
        setCreatingInvite(false);
      });
  };

  const handleDeleteRequest = (requestId: number) => {
    userDeleteOnetimeInviteRequest({ path: { requestId } }).then((response) => {
      if (response.response.ok) {
        setRequests((prev) =>
          prev.filter((request) => request.id !== requestId)
        );
      } else {
        errorToast(`Failed to delete request: ${response.response.statusText}`);
      }
    });
  };

  const pendingRequests = useMemo(
    () => requests.filter((request) => request.status === "pending"),
    [requests]
  );
  const rejectedRequests = useMemo(
    () => requests.filter((request) => request.status === "rejected"),
    [requests]
  );

  return (
    <div className="flex flex-col gap-y-8 py-4">
      <div className="flex flex-col gap-y-3">
        <p className="font-semibold text-xl md:text-2xl">
          Invite someone to your group
        </p>
        {
          <Card style={CardStyle.Grey}>
            <div className="flex flex-col gap-y-2">
              <p className="font-semibold">
                Invite a new member to the Alliance and your group
              </p>
              <p className="text-zinc-500">
                The group leader will first need to approve the request for the
                new member.
              </p>
              <p className="text-zinc-500">
                Once approved, this will create a personalized invite page that
                explains the Alliance and how to sign up.
              </p>
              <p className="text-zinc-500">
                When the new member signs up, they will automatically be added
                to your group.
              </p>
              <input
                type="text"
                className="border border-zinc-300 rounded px-3 h-10"
                placeholder="Enter the invitee's first name"
                value={inviteeName}
                onChange={(e) => setInviteeName(e.target.value)}
              />
              <input
                type="text"
                className="border border-zinc-300 rounded px-3 h-10"
                placeholder="Description"
                value={inviteeDescription}
                onChange={(e) => setInviteeDescription(e.target.value)}
              ></input>
              <Button
                color={ButtonColor.Black}
                onClick={handleRequest}
                className="!h-10"
                disabled={
                  creatingRequest || !inviteeDescription || !inviteeName
                }
              >
                {creatingRequest
                  ? "Creating request..."
                  : "Send request to group leader"}
              </Button>
            </div>
          </Card>
        }
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>

      {pendingRequests.length > 0 && (
        <div className="flex flex-col gap-y-2">
          <p className="font-semibold text-xl">Pending requests</p>
          <List>
            {pendingRequests.map((request) => (
              <OneTimeInviteRequestListItem
                key={request.id}
                type={"member"}
                request={request}
                onDelete={handleDeleteRequest}
              />
            ))}
          </List>
        </div>
      )}

      {invites.length > 0 && (
        <div className="flex flex-col gap-y-2">
          <p className="font-semibold text-xl">Approved requests</p>
          <List>
            {invites.map((invite) => (
              <OneTimeInviteListItem
                key={invite.id}
                invite={invite}
                selfInvited={true}
                onCopy={copyToClipboard}
                onDelete={handleDeleteInvite}
              />
            ))}
          </List>
        </div>
      )}

      {rejectedRequests.length > 0 && (
        <div className="flex flex-col gap-y-2">
          <p className="font-semibold text-xl">Rejected requests</p>
          <List>
            {rejectedRequests.map((request) => (
              <OneTimeInviteRequestListItem
                key={request.id}
                type={"member"}
                request={request}
                onDelete={handleDeleteRequest}
              />
            ))}
          </List>
        </div>
      )}
    </div>
  );
};

export default CommunityInvitesTabMember;
