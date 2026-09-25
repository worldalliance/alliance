import { errorMessage } from "@alliance/common/errorMessage";
import {
  cohortDecisionsCorrectAdmin,
  type CohortDecisionDto,
} from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";

export function CohortDecisionCorrectionModal({
  actionId,
  decision,
  onClose,
}: {
  actionId: number;
  decision: CohortDecisionDto;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const noteId = useId();
  const [note, setNote] = useState("");
  const included = !decision.included;

  const correct = useMutation({
    mutationFn: () =>
      cohortDecisionsCorrectAdmin({
        path: { actionId, userId: decision.userId },
        body: { included, note },
        throwOnError: true,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.actionCohortDecisionsAdmin(actionId),
      });
      onClose();
    },
  });

  const verb = included ? "Assign" : "Exclude";

  return (
    <Modal
      open
      onClose={onClose}
      dismissDisabled={correct.isPending}
      panelClassName="max-w-lg"
    >
      <ModalHeader className="p-6">
        <ModalTitle render={<h3 />} className="text-lg font-medium">
          {verb} {decision.userName}?
        </ModalTitle>
      </ModalHeader>
      <ModalBody className="flex flex-col gap-3 px-6">
        <ModalDescription className="text-sm text-zinc-600">
          {included
            ? "Adds this member to the action's cohort."
            : "Removes this member from the action's cohort."}{" "}
          The current decision stays in the correction history.
        </ModalDescription>
        <label htmlFor={noteId} className="text-sm font-medium">
          Reason
        </label>
        <textarea
          id={noteId}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="rounded border border-gray-2 p-2 text-sm"
        />
        <InlineError
          message={
            correct.error
              ? errorMessage({
                  error: correct.error,
                  fallback: "Could not correct the decision",
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
            disabled={correct.isPending}
          >
            Cancel
          </Button>
          <Button
            color={ButtonColor.Black}
            size="small"
            onClick={() => correct.mutate()}
            disabled={correct.isPending || note.trim() === ""}
          >
            {verb} member
          </Button>
        </ModalActions>
      </ModalFooter>
    </Modal>
  );
}
