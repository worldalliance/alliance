import { errorMessage } from "@alliance/common/errorMessage";
import type { ActionFormAssignmentDto } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import InlineError from "@alliance/sharedweb/ui/InlineError";
import Modal, {
  ModalActions,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@alliance/sharedweb/ui/Modal";
import { useId, useState } from "react";
import { type FormArm, FormArmKind } from "../lib/formArm";
import { useFormAssignmentsAdmin } from "../lib/useFormAssignmentsAdmin";
import NotifyMemberCheckbox from "./NotifyMemberCheckbox";

export default function MoveFormMemberModal(props: {
  actionId: number;
  assignment: ActionFormAssignmentDto;
  kind: FormArmKind;
  /** The variants or branches the member can move to. */
  arms: FormArm[];
  onClose: () => void;
}) {
  const { actionId, assignment, kind, arms, onClose } = props;
  const selectId = useId();
  const [armId, setArmId] = useState<number | null>(arms[0]?.id ?? null);
  const [notify, setNotify] = useState(true);
  const { moveToBranch, moveToVariant } = useFormAssignmentsAdmin(actionId);
  const move = {
    [FormArmKind.Variant]: moveToVariant,
    [FormArmKind.Branch]: moveToBranch,
  }[kind];
  const submit = (id: number) => {
    const done = { onSuccess: onClose };
    const base = { userId: assignment.userId, notify };
    switch (kind) {
      case FormArmKind.Variant:
        return moveToVariant.mutate({ ...base, variantId: id }, done);
      case FormArmKind.Branch:
        return moveToBranch.mutate({ ...base, branchId: id }, done);
      default:
        throw new Error(`unknown form arm kind: ${kind satisfies never}`);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      dismissDisabled={move.isPending}
      panelClassName="max-w-lg"
    >
      <ModalHeader className="p-6">
        <ModalTitle render={<h3 />} className="text-lg font-medium">
          Move {assignment.userName}?
        </ModalTitle>
      </ModalHeader>
      <ModalBody className="flex flex-col gap-3 px-6">
        <ModalDescription className="text-sm text-zinc-600">
          They&apos;ll see the new {kind}&apos;s form and copy from now on. If
          they completed the action, their completion is withdrawn and they
          complete it by submitting the new form; their earlier response stays
          on record. A re-route never moves them back.
        </ModalDescription>
        <label htmlFor={selectId} className="text-sm font-medium">
          Move to
        </label>
        <select
          id={selectId}
          value={armId ?? ""}
          onChange={(e) => setArmId(Number(e.target.value))}
          className="rounded border border-gray-2 p-2 text-sm"
        >
          {arms.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
        <NotifyMemberCheckbox
          checked={notify}
          onChange={setNotify}
          label="Notify the member"
        />
        <InlineError
          message={
            move.error
              ? errorMessage({
                  error: move.error,
                  fallback: "Could not move the member",
                })
              : null
          }
        />
      </ModalBody>
      <ModalFooter className="p-6">
        <ModalActions>
          <Button
            color={ButtonColor.White}
            size="small"
            onClick={onClose}
            disabled={move.isPending}
          >
            Cancel
          </Button>
          <Button
            color={ButtonColor.Black}
            size="small"
            onClick={() => armId !== null && submit(armId)}
            disabled={move.isPending || armId === null}
          >
            Move member
          </Button>
        </ModalActions>
      </ModalFooter>
    </Modal>
  );
}
