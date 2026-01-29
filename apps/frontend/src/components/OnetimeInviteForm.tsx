import { CardStyle } from "@alliance/shared/styles/card";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { useEffect, useRef } from "react";
import { Link } from "react-router";

type SharedProps = {
  inviteeName: string;
  setInviteeName: (value: string) => void;
  creatingInvite: boolean;
};

type LeaderInviteFormProps = SharedProps & {
  isLeader: true;
  onCreateInvite: () => void;
  inviteeDescription?: undefined;
  setInviteeDescription?: undefined;
  onRequestInvite?: undefined;
};

type MemberInviteFormProps = SharedProps & {
  isLeader: false;
  onCreateInvite?: undefined;
  inviteeDescription: string;
  setInviteeDescription: (value: string) => void;
  onRequestInvite: () => void;
};

type OnetimeInviteFormProps = LeaderInviteFormProps | MemberInviteFormProps;

const OnetimeInviteForm = ({
  inviteeName,
  setInviteeName,
  creatingInvite,
  onCreateInvite,
  isLeader,
  inviteeDescription,
  setInviteeDescription,
  onRequestInvite,
}: OnetimeInviteFormProps) => {
  const descriptionInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const descriptionInput = descriptionInputRef.current;
    if (!descriptionInput) {
      return;
    }
    descriptionInput.style.height = "auto";
    descriptionInput.style.height = descriptionInput.scrollHeight + "px";
  }, [inviteeDescription, descriptionInputRef]);

  return (
    <Card style={CardStyle.Grey}>
      {isLeader ? (
        <div className="flex flex-col gap-y-2">
          <p className="font-semibold">
            Invite a new member to the Alliance and your group
          </p>
          <p className="text-zinc-500">
            This will create a personalized invite page that explains the
            Alliance and how to sign up.
          </p>
          <p className="text-zinc-500">
            When the new member signs up, they will automatically be added to
            your group.
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
              value={inviteeName}
              onChange={(e) => setInviteeName(e.target.value)}
            />
            <Button
              color={ButtonColor.Black}
              onClick={onCreateInvite}
              className="!h-10"
              disabled={creatingInvite || !inviteeName}
            >
              {creatingInvite ? "Creating invite..." : "Create invite"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-y-3">
          <p className="font-semibold">
            Invite a new member to the Alliance and this group
          </p>
          <p className="text-zinc-500">
            A group leader will review and approve your request.
          </p>
          <ol className="text-zinc-500 list-decimal list-inside mb-2">
            <li>
              A group lead will first need to approve the request for the
              invitee.
            </li>
            <li>
              Once approved, you will receive a personalized invite link that
              you can share with the invitee.
            </li>
            <li>
              When the invitee signs up, they will automatically be added to
              your group.
            </li>
          </ol>

          <input
            type="text"
            className="border border-zinc-300 rounded px-3 py-2 bg-white"
            placeholder="Enter the invitee's first name"
            value={inviteeName}
            onChange={(e) => setInviteeName(e.target.value)}
          />
          <textarea
            ref={descriptionInputRef}
            className="border border-zinc-300 rounded px-3 py-2 bg-white overflow-hidden"
            placeholder="Context about invitee"
            value={inviteeDescription}
            onChange={(e) => {
              setInviteeDescription(e.target.value);
            }}
            rows={2}
            style={{ resize: "none" }}
          />
          <Button
            color={ButtonColor.Black}
            onClick={onRequestInvite}
            disabled={creatingInvite || !inviteeName}
          >
            {creatingInvite ? "Requesting..." : "Request invite"}
          </Button>
        </div>
      )}
    </Card>
  );
};

export default OnetimeInviteForm;
