import {
  PlaceKind,
  type FormPlace,
} from "@alliance/common/forms/form-conditions";
import { type Page } from "@alliance/common/forms/form-schema";
import { withCount } from "@alliance/common/plural";
import { useState } from "react";
import {
  DependentEntryKind,
  dependentsOutside,
  groupDependents,
} from "../../lib/formDependencies";
import type { VisibilityGroups } from "../../lib/visibilityGroups";
import Button, { ButtonVariant } from "../../ui/Button";
import ConfirmDialog from "../../ui/ConfirmDialog";
import Modal, {
  ModalActions,
  ModalBody,
  ModalDescription,
  ModalTitle,
} from "../../ui/Modal";
import { describePlace } from "./DependencyLinks";

export const DELETION: Record<PlaceKind, { action: string; subject: string }> =
  {
    [PlaceKind.Page]: {
      action: "Delete page",
      subject: "questions on this page",
    },
    [PlaceKind.Element]: {
      action: "Delete question",
      subject: "this question",
    },
    [PlaceKind.SubField]: {
      action: "Delete question",
      subject: "this question",
    },
  };

type PendingDeletion = {
  container: FormPlace;
  /** The form `run` deletes from, which confirming requires to be current. */
  pages: readonly Page[];
  affected: string[];
  run: () => void;
  /** Confirmed after the form changed, so `run` would delete the wrong thing. */
  stale: boolean;
};

/**
 * Deletes at once what no condition outside it reads; otherwise first lists
 * the elements whose conditions read it, deleting only once the admin
 * confirms. Their rules stay as authored.
 */
export function useGuardedDeletion({
  pages,
  groups,
}: {
  pages: readonly Page[];
  groups: VisibilityGroups;
}) {
  const [pending, setPending] = useState<PendingDeletion | null>(null);

  const guard = (container: FormPlace, run: () => void) => {
    const dependents = dependentsOutside(pages, container);
    if (dependents.length === 0) {
      run();
      return;
    }
    const affected = groupDependents({ pages, groups, dependents }).map(
      (entry) =>
        entry.kind === DependentEntryKind.Single
          ? describePlace(pages, entry.dependent.place)
          : `Shared visibility · ${withCount(entry.members.length, "element")}: ${entry.members
              .map(({ place }) => describePlace(pages, place))
              .join(", ")}`,
    );
    setPending({ container, pages, affected, run, stale: false });
  };

  const close = () => setPending(null);
  const confirm = () => {
    if (!pending) return;
    if (pending.pages !== pages) {
      setPending({ ...pending, stale: true });
      return;
    }
    setPending(null);
    pending.run();
  };

  const deletion = pending && DELETION[pending.container.kind];
  const dialog = pending?.stale ? (
    <Modal open onClose={close} panelClassName="max-w-lg">
      <ModalBody className="flex flex-col gap-2 p-6">
        <ModalTitle className="text-heading font-semibold">
          Nothing was deleted
        </ModalTitle>
        <ModalDescription className="text-fg-muted">
          The form changed while this was open. Delete again to see what reads
          it now.
        </ModalDescription>
        <ModalActions className="mt-4">
          <Button variant={ButtonVariant.Default} onClick={close}>
            Close
          </Button>
        </ModalActions>
      </ModalBody>
    </Modal>
  ) : (
    <ConfirmDialog
      open={pending !== null}
      title={deletion ? `${deletion.action}?` : ""}
      message={
        pending && deletion
          ? [
              `Conditions on these read ${deletion.subject}:`,
              ...pending.affected.map((label) => `• ${label}`),
              "",
              "Their rules stay as written, reading a question this form won't have, until you change them.",
            ].join("\n")
          : ""
      }
      confirmLabel={deletion?.action}
      destructive
      onCancel={close}
      onConfirm={confirm}
    />
  );

  return { guard, dialog };
}
