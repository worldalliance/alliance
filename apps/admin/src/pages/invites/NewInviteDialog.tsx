import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useCreateOnetimeInviteAdmin } from "../../lib/useOnetimeInvitesAdmin";
import { useUsersAdmin } from "../../lib/useUsersAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import { Input } from "../../ui/Input";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../ui/Modal";
import { Field } from "../../ui/templates/Form";
import { useToast } from "../../ui/ToastProvider";
import UserSelect from "../../ui/UserSelect";

/** Creates a one-time invite on a member's behalf. Nothing is sent to anyone. */
export function NewInviteDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { success } = useToast();
  const users = useUsersAdmin();
  const [invitee, setInvitee] = useState("");
  const [invitingUserId, setInvitingUserId] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const create = useCreateOnetimeInviteAdmin();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (invitingUserId === null) {
      setProblem("Choose the member who is inviting");
      return;
    }
    setProblem(null);
    create.mutate(
      { invitingUserId, invitee },
      {
        onSuccess: () => {
          success("Invite created", invitee || undefined);
          onCreated();
          onClose();
        },
        onError: (error) =>
          setProblem(adminRefusalMessage(error, "Couldn't create the invite.")),
      },
    );
  };

  return (
    <Modal onClose={onClose} dismissDisabled={create.isPending}>
      <form onSubmit={submit} noValidate>
        <ModalHeader>
          <ModalTitle>New invite</ModalTitle>
        </ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <p className="text-fg-muted">
            Creates a one-time signup link in the member's name. Nothing is
            sent: the link is in this list and in the member's own invites, for
            either of you to pass on.
          </p>
          <Field
            label="Invitee"
            help="Preferably a first name, capitalized. The invite page greets the person by it."
          >
            {(control) => (
              <Input
                {...control}
                value={invitee}
                onChange={(event) => setInvitee(event.target.value)}
              />
            )}
          </Field>
          <UserSelect
            users={users.data ?? []}
            selectedUserIds={invitingUserId === null ? [] : [invitingUserId]}
            onChange={(ids) => {
              if (create.isPending) return;
              setInvitingUserId(ids[0] ?? null);
              setProblem(null);
            }}
            loading={users.isLoading}
            loadFailed={users.isLoadingError}
            label="Inviting member"
            single
          />
        </ModalBody>
        <ModalFooter error={problem}>
          <ModalActions>
            <Button
              variant={ButtonVariant.Default}
              onClick={onClose}
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={ButtonVariant.Primary}
              type="submit"
              busy={create.isPending}
            >
              Create invite
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}
