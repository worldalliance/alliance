import { type FormSchema } from "@alliance/common/forms/form-schema";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Modal, {
  ModalActions,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@alliance/sharedweb/ui/Modal";
import { AlertTriangle } from "lucide-react";
import React, { useMemo } from "react";
import { mergeFormSchemas } from "../lib/formSchemaMerge";
import { SchemaDiffView } from "../lib/schemaDiff";

interface FormConflictModalProps {
  /** Shared starting snapshot. */
  base: FormSchema;
  /** Local unsaved edits. */
  mine: FormSchema;
  /** Current server schema. */
  theirs: FormSchema;
  saving: boolean;
  onMerge: () => void;
  onKeepMine: () => void;
  onTakeTheirs: () => void;
  onCopyMine: () => void;
  onCancel: () => void;
}

/** Stale-save conflict modal. */
export const FormConflictModal: React.FC<FormConflictModalProps> = ({
  base,
  mine,
  theirs,
  saving,
  onMerge,
  onKeepMine,
  onTakeTheirs,
  onCopyMine,
  onCancel,
}) => {
  const merge = useMemo(
    () => mergeFormSchemas(base, mine, theirs),
    [base, mine, theirs],
  );

  return (
    <Modal
      onClose={onCancel}
      dismissOnBackdrop={false}
      dismissDisabled={saving}
      showClose={false}
      panelClassName="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden"
    >
      <ModalHeader className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <div>
          <ModalTitle className="text-lg font-semibold">
            This form was changed by someone else
          </ModalTitle>
          <ModalDescription className="text-sm text-zinc-600">
            Another editor saved changes to this form after you opened it. Your
            edits are still here — nothing has been lost. Review both sets of
            changes below and choose how to proceed.
          </ModalDescription>
        </div>
      </ModalHeader>

      <div className="grid grid-cols-1 gap-4 overflow-auto p-5 md:grid-cols-2">
        <div className="rounded border border-zinc-200 p-3">
          <p className="mb-2 text-xs font-semibold tracking-wide text-zinc-600 uppercase">
            Your changes
          </p>
          <SchemaDiffView before={base} after={mine} />
        </div>
        <div className="rounded border border-zinc-200 p-3">
          <p className="mb-2 text-xs font-semibold tracking-wide text-zinc-600 uppercase">
            Their changes (now saved)
          </p>
          <SchemaDiffView before={base} after={theirs} />
        </div>
      </div>

      <ModalFooter className="p-4">
        {merge.ok ? (
          <p className="mb-3 text-sm text-green-700">
            These edits don&apos;t overlap — they can be merged automatically.
            Review the merged result before saving.
          </p>
        ) : (
          <p className="mb-3 text-sm text-amber-700">
            These edits overlap, so they can&apos;t be merged automatically.
            Keep your version or take theirs.
          </p>
        )}
        <ModalActions className="justify-between">
          <Button
            color={ButtonColor.White}
            size="small"
            onClick={onCopyMine}
            disabled={saving}
          >
            Copy my version (JSON)
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              color={ButtonColor.White}
              size="small"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              color={ButtonColor.White}
              size="small"
              onClick={onTakeTheirs}
              disabled={saving}
            >
              Take theirs
            </Button>
            {merge.ok && (
              <Button
                color={ButtonColor.Black}
                size="small"
                onClick={onMerge}
                disabled={saving}
              >
                Merge changes
              </Button>
            )}
            <Button
              color={merge.ok ? ButtonColor.White : ButtonColor.Black}
              size="small"
              onClick={onKeepMine}
              disabled={saving}
            >
              {saving ? "Saving…" : "Keep mine (overwrite theirs)"}
            </Button>
          </div>
        </ModalActions>
      </ModalFooter>
    </Modal>
  );
};

export default FormConflictModal;
