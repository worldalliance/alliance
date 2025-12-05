import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import { useEffect, useState } from "react";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import { useAuth } from "../lib/AuthContext";
import {
  CreateOnetimeInviteRequestDto,
  OnetimeInviteRequestDto,
  userCreateOnetimeInviteRequest,
  userDeleteOnetimeInviteRequest,
  userGetOnetimeInviteRequestsByRequester,
} from "@alliance/shared/client";
import List from "@alliance/shared/ui/List";
import OneTimeInviteRequestListItem from "./OneTimeInviteRequestListItem";
import { useToast } from "@alliance/shared/ui/ToastProvider";

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

  useEffect(() => {
    userGetOnetimeInviteRequestsByRequester({ path: { communityId } }).then(
      (response) => {
        if (response.data) {
          setRequests(response.data);
        } else {
          setError("Failed to load new member invites");
        }
      }
    );
  }, [communityId]);

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

  requests.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
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

      {requests.length > 0 && (
        <div className="flex flex-col gap-y-2">
          <p className="font-semibold text-xl">Pending requests</p>
          <List>
            {requests.map((request) => (
              <OneTimeInviteRequestListItem
                key={request.id}
                request={request}
                isLeader={false}
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
