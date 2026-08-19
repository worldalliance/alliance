import AppMarkdownWrapper from "@alliance/sharedweb/ui/AppMarkdownWrapper";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";

type OnetimeInviteFormProps = {
  title?: string;
  explanation?: readonly string[];
  inviteePlaceholder?: string;
  inviteeName: string;
  setInviteeName: (value: string) => void;
  onSubmit?: () => void;
  onEnter?: () => void;
  autoFocus?: boolean;
  submitText?: string;
  submittingText?: string;
  creatingInvite?: boolean;
};

const OnetimeInviteForm = ({
  title,
  explanation,
  inviteePlaceholder = "Name of the invitee",
  inviteeName,
  setInviteeName,
  onSubmit,
  onEnter,
  autoFocus = false,
  submitText = "Create invite",
  submittingText = "Creating invite...",
  creatingInvite = false,
}: OnetimeInviteFormProps) => {
  return (
    <div className="flex flex-col gap-y-4">
      {title && explanation && (
        <div className="flex flex-col gap-y-2">
          <p className="text-xl font-semibold text-zinc-900">{title}</p>
          <AppMarkdownWrapper
            className="text-invite-form-body"
            markdownContent={explanation.join("\n\n")}
          />
        </div>
      )}
      <div className="flex flex-col gap-y-4">
        <input
          type="text"
          className="border border-zinc-300 rounded px-3 py-2 flex-1"
          placeholder={inviteePlaceholder}
          value={inviteeName}
          autoFocus={autoFocus}
          onChange={(e) => setInviteeName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") {
              return;
            }
            e.preventDefault();
            onEnter?.();
          }}
        />
        {onSubmit && (
          <Button
            color={ButtonColor.Black}
            onClick={onSubmit}
            disabled={creatingInvite || !inviteeName.trim()}
            className="w-full"
          >
            {creatingInvite ? submittingText : submitText}
          </Button>
        )}
      </div>
    </div>
  );
};

export default OnetimeInviteForm;
