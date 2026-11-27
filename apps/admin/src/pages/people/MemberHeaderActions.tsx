import type { UserAdminDetailDto } from "@alliance/shared/client/types.gen";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { getApiUrl } from "../../lib/config";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import type { useUserDetailAdmin } from "../../lib/useUserDetailAdmin";
import { PlaceId, placeById } from "../../places";
import Button, { ButtonVariant } from "../../ui/Button";
import { MoreMenu } from "../../ui/MoreMenu";
import { useToast } from "../../ui/ToastProvider";
import { MemberDeleteDialog } from "./MemberDeleteDialog";
import type { MemberErrorReporting } from "./memberRules";

/** Log in as the member, suspend their contract, delete their account. */
export function MemberHeaderActions({
  user,
  detail,
  reportError,
  clearError,
}: MemberErrorReporting & {
  user: UserAdminDetailDto;
  detail: ReturnType<typeof useUserDetailAdmin>;
}) {
  const confirm = useConfirmOnPage();
  const { success } = useToast();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const suspension = detail.suspendContract;

  // From the server's suspendContract: the member leaves every group they
  // belong to as a member, keeps the groups they lead, and each group's
  // leaders are notified.
  const suspend = async () => {
    const confirmed = await confirm({
      title: `Suspend ${user.name}'s contract?`,
      message:
        "They are removed from the groups they are a member of, and those groups' leaders are notified. Groups they lead keep them as leader.",
      confirmLabel: "Suspend contract",
      destructive: true,
    });
    if (!confirmed) return;
    clearError();
    try {
      await suspension.mutateAsync();
      success("Contract suspended", user.name);
    } catch (error) {
      reportError(adminRefusalMessage(error, "Couldn't suspend the contract."));
    }
  };

  return (
    <>
      <Button
        variant={ButtonVariant.Default}
        title={`Opens the member app in a new tab, signed in as ${user.name}`}
        onClick={() =>
          window.open(`${getApiUrl()}/auth/impersonate/${user.id}`, "_blank")
        }
      >
        Log in as member
        <ExternalLink aria-hidden="true" className="size-4 text-fg-muted" />
      </Button>
      <MoreMenu
        busy={suspension.isPending}
        items={[
          {
            label: "Suspend contract…",
            onSelect: () => void suspend(),
            disabledReason: user.hasActiveContract
              ? undefined
              : "No active contract",
          },
          {
            label: "Delete account…",
            onSelect: () => setDeleting(true),
            destructive: true,
          },
        ]}
      />
      {deleting && (
        <MemberDeleteDialog
          member={user}
          deleteAccount={detail.deleteAccount.mutateAsync}
          onCancel={() => setDeleting(false)}
          onDeleted={() => {
            setDeleting(false);
            success("Account deleted", user.name);
            void navigate(placeById(PlaceId.People).path);
          }}
        />
      )}
    </>
  );
}
