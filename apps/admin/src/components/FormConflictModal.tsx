import { type FormSchema } from "@alliance/common/forms/form-schema";
import type { FormSchemaValidationContext } from "@alliance/common/forms/form-schema-validate";
import React, { useMemo } from "react";
import { mergeFormSchemas } from "../lib/formSchemaMerge";
import { SchemaDiffView } from "../lib/schemaDiff";
import Button, { ButtonVariant } from "../ui/Button";
import Modal, {
  ModalActions,
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "../ui/Modal";
import { Banner, BannerTone } from "../ui/templates/Banner";

interface FormConflictModalProps {
  /** Shared starting snapshot. */
  base: FormSchema;
  /** Local unsaved edits. */
  mine: FormSchema;
  /** Current server schema. */
  theirs: FormSchema;
  validation: FormSchemaValidationContext;
  sourceFormsLoading: boolean;
  sourceFormsFailed: boolean;
  saving: boolean;
  onMerge: () => void;
  onKeepMine: () => void;
  onTakeTheirs: () => void;
  onCopyMine: () => void;
  onCancel: () => void;
  /** A failed Keep mine, merge or copy, said above the buttons. */
  error?: string | null;
}

/** Stale-save conflict modal. */
export const FormConflictModal: React.FC<FormConflictModalProps> = ({
  base,
  mine,
  theirs,
  validation,
  sourceFormsLoading,
  sourceFormsFailed,
  saving,
  onMerge,
  onKeepMine,
  onTakeTheirs,
  onCopyMine,
  onCancel,
  error,
}) => {
  const merge = useMemo(
    () =>
      sourceFormsLoading || sourceFormsFailed
        ? undefined
        : mergeFormSchemas({ base, mine, theirs, validation }),
    [base, mine, theirs, validation, sourceFormsLoading, sourceFormsFailed],
  );

  return (
    <Modal
      onClose={onCancel}
      dismissOnBackdrop={false}
      dismissDisabled={saving}
      showClose={false}
      panelClassName="flex max-h-dvh max-w-5xl flex-col overflow-hidden"
    >
      <ModalHeader>
        <ModalTitle render={<h2 />}>
          This form was changed by someone else
        </ModalTitle>
        <p className="mt-1 text-fg-muted">
          Another editor saved changes to this form after you opened it. Your
          edits are still here.
        </p>
      </ModalHeader>

      <ModalBody className="flex min-h-0 flex-col gap-4 overflow-auto">
        <MergeStatus loading={sourceFormsLoading} merge={merge} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <section aria-labelledby="conflict-mine">
            <h3 id="conflict-mine" className="mb-2 font-semibold">
              Your changes
            </h3>
            <div className="rounded-card border border-line p-3">
              <SchemaDiffView before={base} after={mine} />
            </div>
          </section>
          <section aria-labelledby="conflict-theirs">
            <h3 id="conflict-theirs" className="mb-2 font-semibold">
              Their changes
            </h3>
            <div className="rounded-card border border-line p-3">
              <SchemaDiffView before={base} after={theirs} />
            </div>
          </section>
        </div>
      </ModalBody>

      <ModalFooter error={error}>
        <ModalActions className="justify-between">
          <Button
            variant={ButtonVariant.Ghost}
            onClick={onCopyMine}
            disabled={saving}
          >
            Copy my version (JSON)
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={ButtonVariant.Default}
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant={ButtonVariant.Default}
              onClick={onTakeTheirs}
              disabled={saving}
            >
              Take theirs
            </Button>
            {merge?.ok && (
              <Button
                variant={ButtonVariant.Default}
                onClick={onMerge}
                disabled={saving}
              >
                Merge changes
              </Button>
            )}
            <Button
              variant={ButtonVariant.Primary}
              onClick={onKeepMine}
              busy={saving}
            >
              Keep mine (overwrite theirs)
            </Button>
          </div>
        </ModalActions>
      </ModalFooter>
    </Modal>
  );
};

function MergeStatus({
  loading,
  merge,
}: {
  loading: boolean;
  merge: ReturnType<typeof mergeFormSchemas> | undefined;
}) {
  if (loading) {
    return (
      <Banner tone={BannerTone.Info} inline>
        Loading the forms your formulas read…
      </Banner>
    );
  }
  if (merge === undefined) {
    return (
      <Banner tone={BannerTone.Warning} inline>
        A form your formulas read couldn&apos;t be loaded, so these edits
        can&apos;t be merged automatically. Keep your version or take theirs.
      </Banner>
    );
  }
  return merge.ok ? (
    <Banner tone={BannerTone.Info} inline>
      Your changes and theirs don&apos;t overlap. Merge them, then review and
      save.
    </Banner>
  ) : (
    <Banner tone={BannerTone.Warning} inline>
      Your changes and theirs overlap, so they can&apos;t be merged
      automatically. Keep your version or take theirs.
    </Banner>
  );
}

export default FormConflictModal;
