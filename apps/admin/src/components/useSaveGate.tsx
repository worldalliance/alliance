import type { FormSchema } from "@alliance/common/forms/form-schema";
import {
  collectUnresolvedVariableReferences,
  type UnresolvedVariableReference,
} from "@alliance/common/forms/variable-interpolation";
import { useCallback, useMemo, useState } from "react";
import ConfirmDialog from "./ConfirmDialog";

function describeUnresolvedReferences(
  references: UnresolvedVariableReference[],
): string {
  const lines = references.map(
    ({ name, locations }) => `#{${name}} — in ${locations.join(", ")}`,
  );
  return [
    "These references don't match any variable on this form, so respondents will see them exactly as written:",
    "",
    ...lines,
    "",
    "Save anyway?",
  ].join("\n");
}

/**
 * Save, unless `blocked`, which runs `onBlocked` instead. A schema with
 * unmatched variable references saves only once the dialog is confirmed.
 */
export function useSaveGate({
  schema,
  blocked,
  onBlocked,
  saveForm,
  isSaving,
}: {
  schema: FormSchema;
  blocked: boolean;
  onBlocked: () => void;
  saveForm: () => Promise<void>;
  isSaving: boolean;
}) {
  const [confirmUnresolvedVariables, setConfirmUnresolvedVariables] =
    useState(false);

  // A dangling `#{name}` renders as written rather than breaking the form, so
  // it is worth a confirmation but not a refusal — an admin renaming a variable
  // would otherwise be unable to save until every reference was updated.
  const unresolvedVariableReferences = useMemo(
    () => collectUnresolvedVariableReferences(schema),
    [schema],
  );

  const handleSaveForm = useCallback(() => {
    if (blocked) {
      onBlocked();
      return;
    }
    if (unresolvedVariableReferences.length > 0) {
      setConfirmUnresolvedVariables(true);
      return;
    }
    void saveForm();
  }, [blocked, onBlocked, saveForm, unresolvedVariableReferences]);

  const dialog = (
    <ConfirmDialog
      isOpen={confirmUnresolvedVariables}
      title="Save with unmatched variable references?"
      message={describeUnresolvedReferences(unresolvedVariableReferences)}
      isLoading={isSaving}
      onCancel={() => setConfirmUnresolvedVariables(false)}
      onConfirm={() => {
        setConfirmUnresolvedVariables(false);
        void saveForm();
      }}
    />
  );

  return { handleSaveForm, dialog };
}
