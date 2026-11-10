import type { CohortDecisionDto } from "@alliance/shared/client";
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
import { adminRefusalMessage } from "../lib/adminRefusal";
import {
  ArmChangeKind,
  useArmMovePreviewAdmin,
  useChangeArmAdmin,
} from "../lib/useCohortDecisionsAdmin";

export type SplitArmOption = { actionId: number; name: string };

const historyDone = (preview: {
  hasCompletion: boolean;
  hasSubmittedResponse: boolean;
}) =>
  [
    preview.hasCompletion && "a completion",
    preview.hasSubmittedResponse && "a submitted response",
  ].filter((part) => part !== false);

export function ArmChangeModal({
  kind,
  actionId,
  decision,
  arms,
  onClose,
}: {
  kind: ArmChangeKind;
  /** The arm whose cohort decisions are open. */
  actionId: number;
  decision: CohortDecisionDto;
  arms: SplitArmOption[];
  onClose: () => void;
}) {
  const targetId = useId();
  const noteId = useId();
  const [note, setNote] = useState("");
  const [target, setTarget] = useState<number | null>(null);
  const preview = useArmMovePreviewAdmin({
    actionId,
    userId: decision.userId,
  });
  const change = useChangeArmAdmin({
    armActionIds: arms.map((arm) => arm.actionId),
    onSuccess: onClose,
  });

  const current = preview.data?.currentArmActionId ?? null;
  const currentName =
    current === null
      ? null
      : (arms.find((arm) => arm.actionId === current)?.name ??
        `Action #${current}`);
  const done = preview.data ? historyDone(preview.data) : [];
  const moving = kind === ArmChangeKind.Move;
  const targets = arms.filter((arm) => arm.actionId !== current);
  const ready =
    preview.isSuccess &&
    note.trim() !== "" &&
    (!moving || target !== null) &&
    !change.isPending;

  const submit = () =>
    change.mutate({
      kind,
      actionId: moving && target !== null ? target : actionId,
      userId: decision.userId,
      note,
    });

  return (
    <Modal
      open
      onClose={onClose}
      dismissDisabled={change.isPending}
      panelClassName="max-w-lg"
    >
      <ModalHeader className="p-6">
        <ModalTitle render={<h3 />} className="text-lg font-medium">
          {moving
            ? `Move ${decision.userName} to another arm?`
            : `Remove ${decision.userName} from the split?`}
        </ModalTitle>
      </ModalHeader>
      <ModalBody className="flex flex-col gap-3 px-6">
        <ModalDescription className="text-sm text-zinc-600">
          {moving
            ? "Gives this member the arm you pick and takes them out of every other arm of the split."
            : "Takes this member out of every arm of the split, so they get none of them."}{" "}
          Their current decisions stay in the correction history.
        </ModalDescription>
        {preview.isPending ? (
          <p className="text-sm text-zinc-500">
            Checking the member&apos;s current arm…
          </p>
        ) : preview.isError ? (
          <InlineError
            message={adminRefusalMessage(
              preview.error,
              "Could not check the member's current arm",
            )}
          />
        ) : (
          <>
            <p className="text-sm">
              {currentName
                ? `Now in ${currentName}.`
                : "Now in none of the split's arms."}
            </p>
            {currentName && done.length > 0 && (
              <p role="status" className="text-sm text-yellow-800">
                {decision.userName} has {done.join(" and ")} on {currentName}.
                It stays on that arm as history, and from the change on only
                their new arm counts toward their missed-suite streak.
              </p>
            )}
          </>
        )}
        {moving && (
          <>
            <label htmlFor={targetId} className="text-sm font-medium">
              Move to
            </label>
            <select
              id={targetId}
              value={target ?? ""}
              onChange={(e) =>
                setTarget(e.target.value ? Number(e.target.value) : null)
              }
              className="rounded border border-gray-2 p-2 text-sm"
            >
              <option value="">Pick an arm…</option>
              {targets.map((arm) => (
                <option key={arm.actionId} value={arm.actionId}>
                  {arm.name}
                </option>
              ))}
            </select>
          </>
        )}
        <label htmlFor={noteId} className="text-sm font-medium">
          Reason (required)
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
            change.error
              ? adminRefusalMessage(
                  change.error,
                  moving
                    ? "Could not move the member"
                    : "Could not remove the member from the split",
                )
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
            disabled={change.isPending}
          >
            Cancel
          </Button>
          <Button
            color={ButtonColor.Black}
            size="small"
            onClick={submit}
            disabled={!ready}
          >
            {moving ? "Move member" : "Remove from split"}
          </Button>
        </ModalActions>
      </ModalFooter>
    </Modal>
  );
}
