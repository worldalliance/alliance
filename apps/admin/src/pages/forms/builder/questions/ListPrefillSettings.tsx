import { fieldPickerLabel } from "@alliance/common/forms/element-descriptors";
import type { ListField } from "@alliance/common/forms/form-schema";
import { useFormOptions } from "@alliance/shared/lib/useFormsAdmin";
import { useFormQuestionFields } from "@alliance/shared/lib/useFormSchema";
import {
  formFieldsErrorReason,
  FormPickerError,
  FormPickerErrorReason,
} from "../../../../components/FormPickerError";
import { Select } from "../../../../ui/Select";
import { Field } from "../../../../ui/templates/Form";
import { InspectorGroup } from "../kit/InspectorGroup";

export function ListPrefillSettings({
  field,
  onUpdate,
}: {
  field: ListField;
  onUpdate: (updates: Partial<ListField>) => void;
}) {
  const { options: prefillForms, isError: formListFailed } = useFormOptions();
  const prefill = field.prefillFromPreviousAnswer;
  const { fields: sourceFields, status: sourceStatus } = useFormQuestionFields(
    prefill?.sourceFormId,
  );
  const sourceError = formFieldsErrorReason(sourceStatus);

  const sourceListFields = sourceFields.filter(
    (f): f is ListField => f.kind === "list",
  );
  const sourceSubFields =
    sourceListFields.find((f) => f.id === prefill?.sourceFieldId)?.fields ?? [];
  const subFields = field.fields ?? [];

  const update = (updates: Partial<NonNullable<typeof prefill>>) =>
    onUpdate({
      prefillFromPreviousAnswer: { ...prefill!, ...updates },
    });

  return (
    <InspectorGroup
      title="Prefill from previous answer"
      description="Pre-populate this list with items from a previously submitted list field."
    >
      <Field label="Source form">
        {(control) => (
          <>
            <Select
              {...control}
              value={prefill?.sourceFormId ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                onUpdate({
                  prefillFromPreviousAnswer: value
                    ? {
                        sourceFormId: Number(value),
                        sourceFieldId: "",
                        sourceSubFieldId: "",
                        targetSubFieldId: "",
                      }
                    : undefined,
                });
              }}
            >
              <option value="">None</option>
              {prefillForms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title} ({f.displaySlug})
                </option>
              ))}
            </Select>
            {formListFailed && (
              <FormPickerError reason={FormPickerErrorReason.FormList} />
            )}
          </>
        )}
      </Field>

      {prefill?.sourceFormId && (
        <Field label="Source list">
          {(control) => (
            <>
              <Select
                {...control}
                value={prefill.sourceFieldId}
                onChange={(event) =>
                  update({
                    sourceFieldId: event.target.value,
                    sourceSubFieldId: "",
                    targetSubFieldId: "",
                  })
                }
              >
                <option value="">Select a list field…</option>
                {sourceListFields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {fieldPickerLabel(f)}
                  </option>
                ))}
              </Select>
              {sourceError && <FormPickerError reason={sourceError} />}
            </>
          )}
        </Field>
      )}

      {prefill?.sourceFieldId && sourceSubFields.length > 0 && (
        <Field label="Source sub-field" help="The sub-field to read from.">
          {(control) => (
            <Select
              {...control}
              value={prefill.sourceSubFieldId}
              onChange={(event) =>
                update({
                  sourceSubFieldId: event.target.value,
                  targetSubFieldId: "",
                })
              }
            >
              <option value="">Select a sub-field…</option>
              {sourceSubFields.map((sf) => (
                <option key={sf.id} value={sf.id}>
                  {fieldPickerLabel(sf)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}

      {prefill?.sourceSubFieldId && (
        <Field label="Target sub-field" help="The sub-field to write into.">
          {(control) => (
            <Select
              {...control}
              value={prefill.targetSubFieldId}
              onChange={(event) =>
                update({ targetSubFieldId: event.target.value })
              }
            >
              <option value="">Select a sub-field…</option>
              {subFields.map((sf) => (
                <option key={sf.id} value={sf.id}>
                  {fieldPickerLabel(sf)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
    </InspectorGroup>
  );
}
