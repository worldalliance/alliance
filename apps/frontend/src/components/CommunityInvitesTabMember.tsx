import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import { useEffect, useState } from "react";
import Card, { CardStyle } from "@alliance/shared/ui/Card";
import { useAuth } from "../lib/AuthContext";
import {
  CreateOnetimeInviteDto,
  OnetimeInviteDto,
  userCreateOnetimeInvite,
  userGetOnetimeInvitesByRequester,
} from "@alliance/shared/client";
import OneTimeInviteListItem from "./OneTimeInviteListItem";
import { getBaseUrl } from "@alliance/shared/lib/config";
import List from "@alliance/shared/ui/List";

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
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [invites, setInvites] = useState<OnetimeInviteDto[]>([]);

  useEffect(() => {
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
    const url = `${baseUrl}/invite?ref=${text}`;
    navigator.clipboard.writeText(url);
  };

  const handleInvite = () => {
    if (!user) {
      return;
    }
    setCreatingInvite(true);
    const body = {
      invitee: inviteeName,
      inviteeDescription,
      communityId,
      invitingUserId: user.id,
    } satisfies CreateOnetimeInviteDto;

    userCreateOnetimeInvite({ body })
      .then((response) => {
        if (response.data) {
          setInviteeName("");
          setInviteeDescription("");
          setInvites((prev) => [response.data, ...prev]);
          setError(null);
        }
      })
      .finally(() => {
        setCreatingInvite(false);
      });
  };

  invites.sort(
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
                onClick={handleInvite}
                className="!h-10"
                disabled={creatingInvite || !inviteeDescription || !inviteeName}
              >
                {creatingInvite
                  ? "Creating invite..."
                  : "Send request to group leader"}
              </Button>
            </div>
          </Card>
        }
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>

      <div className="flex flex-col gap-y-2">
        <p className="font-semibold text-xl">Past invites</p>
        <List>
          {invites.map((invite) => (
            <OneTimeInviteListItem
              key={invite.id}
              invite={invite}
              onDelete={() => {
                /* asdf */
              }}
              onCopy={copyToClipboard}
            />
          ))}
        </List>
      </div>
    </div>
  );
};

export default CommunityInvitesTabMember;
