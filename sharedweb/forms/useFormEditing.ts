import {
  type AnyField,
  type FormValue,
} from "@alliance/common/forms/form-schema";
import { applyUploadedImage } from "@alliance/shared/forms/fileUploadSlots";
import {
  resolveFormValue,
  type SetFieldValue,
} from "@alliance/shared/forms/formValueUpdater";
import { type FieldErrorUpdater } from "@alliance/shared/forms/useFormValidation";
import { useImageUpload } from "@alliance/shared/lib/useImageUpload";
import { type FormVisibility } from "@alliance/shared/useFormRenderer";

export function useFormEditing({
  readOnly,
  edited,
  markEdited,
  onFormStarted,
  setFormData,
  fieldLookup,
  validateFieldValue,
  applyFieldErrorUpdates,
}: {
  readOnly: boolean;
  edited: boolean;
  markEdited: () => void;
  onFormStarted?: () => void;
  setFormData: (
    update: (prev: Record<string, FormValue>) => Record<string, FormValue>,
  ) => void;
  fieldLookup: Map<string, AnyField>;
  validateFieldValue: FormVisibility["validateFieldValue"];
  applyFieldErrorUpdates: FieldErrorUpdater;
}) {
  const ensureStarted = () => {
    if (readOnly) return;
    try {
      if (!edited) onFormStarted?.();
    } finally {
      markEdited();
    }
  };

  const updateField: SetFieldValue = (fieldId, value) => {
    if (readOnly) return;
    ensureStarted();
    setFormData((prev) => {
      const next = {
        ...prev,
        [fieldId]: resolveFormValue(value, prev[fieldId]),
      };
      const fieldDefinition = fieldLookup.get(fieldId);
      if (fieldDefinition) {
        const nextValue = next[fieldId];
        if (fieldDefinition.kind === "multiselect") {
          const selections = Array.isArray(nextValue) ? nextValue : [];
          const validationResult =
            selections.length === 0
              ? null
              : validateFieldValue(fieldDefinition, nextValue, next);
          applyFieldErrorUpdates({ [fieldId]: validationResult });
        } else if (fieldDefinition.kind === "ranking") {
          // Don't flag partial rankings while the user is still placing
          // items; page validation on submit enforces completeness.
          applyFieldErrorUpdates({ [fieldId]: null });
        } else {
          const requiredError = validateFieldValue(
            fieldDefinition,
            nextValue,
            next,
          );
          if (fieldDefinition.kind === "list") {
            applyFieldErrorUpdates({ [fieldId]: requiredError }, fieldId);
          } else {
            applyFieldErrorUpdates({ [fieldId]: requiredError });
          }
        }
      } else {
        applyFieldErrorUpdates({ [fieldId]: null });
      }
      return next;
    });
  };

  const imageUpload = useImageUpload({
    onUploaded: (slot, imageKey) =>
      applyUploadedImage({ slot, imageKey, setFieldValue: updateField }),
    onStart: ensureStarted,
  });

  return { updateField, imageUpload };
}
