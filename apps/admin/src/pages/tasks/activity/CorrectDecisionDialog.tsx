import type { CohortDecisionDto } from "@alliance/shared/client";
import { useRef, useState } from "react";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { useCorrectCohortDecisionAdmin } from "../../../lib/useCohortDecisionsAdmin";
import Button, { ButtonVariant } from "../../../ui/Button";
import Modal, {
  ModalActions,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../../../ui/Modal";
import { Textarea } from "../../../ui/Textarea";
import { Field } from "../../../ui/templates/Form";

// From the server's `CohortDecisionStaffService.correct`: it flips the saved
// decision and keeps the old one in the history. Readers take the cohort from
// the saved decisions (`readsSavedDecisions`), and nothing is sent by it.
const CONSEQUENCE = {
  assign:
    "Assigns them to this task, counting them in its cohort. Nothing is sent to them now.",
  exclude:
    "Takes them out of this task's cohort. Nothing is sent to them, and what they already did stays recorded.",
} as const;

export function CorrectDecisionDialog({
  actionId,
  decision,
  onClose,
}: {
  actionId: number;
  decision: CohortDecisionDto;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const included = !decision.included;
  const correct = useCorrectCohortDecisionAdmin({
    actionId,
    onSuccess: onClose,
  });
  const verb = included ? "Assign" : "Exclude";

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (note.trim() === "") {
      setProblem("Say why you are correcting it");
      return;
    }
    setProblem(null);
    correct.mutate(
      { userId: decision.userId, included, note },
      {
        onError: (error) =>
          setProblem(
            adminRefusalMessage(error, "Couldn't correct the decision."),
          ),
      },
    );
  };

  return (
    <Modal
      onClose={onClose}
      dismissDisabled={correct.isPending}
      initialFocus={reasonRef}
    >
      <form onSubmit={submit}>
        <ModalHeader>
          <ModalTitle>
            {verb} {decision.userName}?
          </ModalTitle>
        </ModalHeader>
        <ModalBody>
          <ModalDescription className="mb-3 text-fg-muted">
            {CONSEQUENCE[included ? "assign" : "exclude"]} The current decision
            stays in the correction history.
          </ModalDescription>
          <Field label="Reason" mark="required">
            {(control) => (
              <Textarea
                {...control}
                ref={reasonRef}
                value={note}
                rows={3}
                onChange={(event) => {
                  setNote(event.target.value);
                  setProblem(null);
                }}
              />
            )}
          </Field>
        </ModalBody>
        <ModalFooter error={problem}>
          <ModalActions>
            <Button
              variant={ButtonVariant.Default}
              onClick={onClose}
              disabled={correct.isPending}
            >
              Cancel
            </Button>
            <Button
              variant={ButtonVariant.Primary}
              type="submit"
              busy={correct.isPending}
            >
              {verb} member
            </Button>
          </ModalActions>
        </ModalFooter>
      </form>
    </Modal>
  );
}
