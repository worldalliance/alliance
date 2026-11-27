import { ChevronRight } from "lucide-react";
import React, { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { formHref } from "../lib/hrefs";
import {
  getDirectSnapshotTarget,
  type ReturnToState,
  type SnapshotMigrationTarget,
} from "../lib/navigation";
import Button, { ButtonVariant } from "../ui/Button";
import Modal, {
  ModalActions,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../ui/Modal";

export type SnapshotTargetPickerProps = {
  targets: SnapshotMigrationTarget[];
  onSelect: (target: SnapshotMigrationTarget) => void;
  onCancel: () => void;
};

/** Asks which form's versions to reassign, where variants give several. */
export const SnapshotTargetPicker: React.FC<SnapshotTargetPickerProps> = ({
  targets,
  onSelect,
  onCancel,
}) => (
  <Modal onClose={onCancel} panelClassName="max-w-md">
    <ModalHeader>
      <ModalTitle>Reassign snapshots</ModalTitle>
      <ModalDescription className="mt-1 text-fg-muted">
        Each variant's form keeps its own versions. Pick the one whose responses
        you want to move to its current version.
      </ModalDescription>
    </ModalHeader>
    <ModalBody>
      <ul className="flex flex-col gap-2">
        {targets.map((target) => (
          <li key={target.formId}>
            <button
              type="button"
              onClick={() => onSelect(target)}
              className="flex w-full items-center gap-3 rounded-md border border-line px-3 py-2.5 text-left focus-ring hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1 truncate font-medium">
                {target.name}
              </span>
              <span className="font-mono text-xs text-fg-muted">
                Form {target.formId}
              </span>
              <ChevronRight
                aria-hidden="true"
                className="size-4 text-fg-muted"
              />
            </button>
          </li>
        ))}
      </ul>
    </ModalBody>
    <ModalFooter>
      <ModalActions>
        <Button variant={ButtonVariant.Default} onClick={onCancel}>
          Cancel
        </Button>
      </ModalActions>
    </ModalFooter>
  </Modal>
);

/**
 * Goes to a form's Versions tab to reassign its responses' versions, asking
 * which form first when there are several and the variant picked doesn't say.
 */
export function useSnapshotReassign(params: {
  targets?: SnapshotMigrationTarget[];
  selectedFormId?: number | null;
}): { reassign: (() => void) | undefined; picker: ReactNode } {
  const { targets, selectedFormId } = params;
  const navigate = useNavigate();
  const location = useLocation();
  const [picking, setPicking] = useState(false);

  const direct = getDirectSnapshotTarget({ targets, selectedFormId });

  const goTo = (formId: number) =>
    navigate(formHref(formId, "versions"), {
      state: {
        returnTo: `${location.pathname}${location.search}`,
      } satisfies ReturnToState,
    });

  // Picking is withdrawn once moot, so a refresh that resolves the ambiguity
  // and a later one that brings it back doesn't reopen the dialog unasked.
  useEffect(() => {
    if (direct || !targets?.length) setPicking(false);
  }, [direct, targets]);

  return {
    reassign: targets?.length
      ? () => (direct ? void goTo(direct.formId) : setPicking(true))
      : undefined,
    picker:
      picking && !direct && targets?.length ? (
        <SnapshotTargetPicker
          targets={targets}
          onSelect={(target) => {
            setPicking(false);
            void goTo(target.formId);
          }}
          onCancel={() => setPicking(false)}
        />
      ) : null,
  };
}

export default SnapshotTargetPicker;
