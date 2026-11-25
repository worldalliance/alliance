import { useState } from "react";
import { MembershipChange } from "../../lib/useCommunitiesAdmin";
import type { useUsersAdmin } from "../../lib/useUsersAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../ui/Modal";
import UserSelect from "../../ui/UserSelect";
import type { GroupMembership } from "./useGroupMembership";

export type AddChange = MembershipChange.AddMember | MembershipChange.AddLeader;

const COPY: Record<
  AddChange,
  { title: string; pick: string; submit: string; fallback: string }
> = {
  [MembershipChange.AddMember]: {
    title: "Add a member",
    pick: "Member to add",
    submit: "Add member",
    fallback: "Unable to add member. Please try again.",
  },
  [MembershipChange.AddLeader]: {
    title: "Add a leader",
    pick: "Leader to add",
    submit: "Add leader",
    fallback: "Unable to add leader. Please try again.",
  },
};

export function AddPersonDialog({
  change,
  users,
  membership,
  onClose,
}: {
  change: AddChange;
  users: ReturnType<typeof useUsersAdmin>;
  membership: GroupMembership;
  onClose: () => void;
}) {
  const copy = COPY[change];
  const [picked, setPicked] = useState<number[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (picked.length === 0) {
      setProblem("Pick someone to add.");
      return;
    }
    setAdding(true);
    const added = await membership.apply({
      change,
      userId: picked[0],
      fallback: copy.fallback,
      report: false,
    });
    setAdding(false);
    if (added.ok) onClose();
    else setProblem(added.error);
  };

  return (
    <Modal onClose={onClose} dismissDisabled={adding}>
      <form onSubmit={(event) => void submit(event)}>
        <ModalHeader>
          <ModalTitle>{copy.title}</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <UserSelect
            users={users.data ?? []}
            selectedUserIds={picked}
            onChange={(ids) => {
              if (adding) return;
              setPicked(ids);
              setProblem(null);
            }}
            loading={users.isLoading}
            loadFailed={users.isLoadingError}
            label={copy.pick}
            single
          />
        </ModalBody>
        <ModalFooter className="flex flex-col gap-3">
          {problem && (
            <p role="alert" className="text-danger">
              {problem}
            </p>
          )}
          <ModalActions>
            <Button
              variant={ButtonVariant.Default}
              onClick={onClose}
              disabled={adding}
            >
              Cancel
            </Button>
            <Button variant={ButtonVariant.Primary} type="submit" busy={adding}>
              {copy.submit}
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}
