import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import { useState } from "react";
import Card, { CardStyle } from "@alliance/shared/ui/Card";

export interface CommunityInvitesTabMemberProps {
  communityId: number;
}

const CommunityInvitesTabMember = ({}: CommunityInvitesTabMemberProps) => {
  const [error] = useState<string | null>(null);
  const [inviteeName, setInviteeName] = useState("");
  const [inviteeDescription, setInviteeDescription] = useState("");
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
                onClick={() => {
                  /* asdf */
                }}
                className="!h-10"
                disabled={!inviteeDescription || !inviteeName}
              >
                Send request to group leader
              </Button>
            </div>
          </Card>
        }
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>

      <div className="flex flex-col gap-y-2">
        <p className="font-semibold text-xl">Past invites</p>
      </div>
    </div>
  );
};

export default CommunityInvitesTabMember;
