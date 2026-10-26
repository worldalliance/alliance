import { errorMessage } from "@alliance/common/errorMessage";
import type {
  ActionFormAssignmentDto,
  ActionFormVariantDto,
} from "@alliance/shared/client";
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
import { useFormAssignmentsAdmin } from "../lib/useFormAssignmentsAdmin";
import NotifyMemberCheckbox from "./NotifyMemberCheckbox";

export default function MoveFormMemberModal(props: {
  actionId: number;
  assignment: ActionFormAssignmentDto;
  /** The variants the member can move to. */
  variants: ActionFormVariantDto[];
  onClose: () => void;
}) {
  const { actionId, assignment, variants, onClose } = props;
  const selectId = useId();
  const [variantId, setVariantId] = useState<number | null>(
    variants[0]?.id ?? null,
  );
  const [notify, setNotify] = useState(true);
  const { move } = useFormAssignmentsAdmin(actionId);

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
          They&apos;ll see the new variant&apos;s form and copy from now on. If
          they completed the action, their completion is withdrawn and they
          complete it by submitting the new form; their earlier response stays
          on record. A re-route never moves them back.
        </ModalDescription>
        <label htmlFor={selectId} className="text-sm font-medium">
          Move to
        </label>
        <select
          id={selectId}
          value={variantId ?? ""}
          onChange={(e) => setVariantId(Number(e.target.value))}
          className="rounded border border-gray-2 p-2 text-sm"
        >
          {variants.map((v) => (
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
            onClick={() =>
              variantId !== null &&
              move.mutate(
                { userId: assignment.userId, variantId, notify },
                { onSuccess: onClose },
              )
            }
            disabled={move.isPending || variantId === null}
          >
            Move member
          </Button>
        </ModalActions>
      </ModalFooter>
    </Modal>
  );
}
