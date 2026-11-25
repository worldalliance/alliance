import type { PreviousAnswerBlock } from "@alliance/common/forms/display-blocks";
import { fieldPickerLabel } from "@alliance/common/forms/element-descriptors";
import { DEFAULT_PREVIOUS_ANSWER_EMPTY_TEXT } from "@alliance/shared/lib/previousAnswers";
import { useFormQuestionFields } from "@alliance/shared/lib/useFormSchema";
import { useFormOptions } from "@alliance/shared/lib/useFormsAdmin";
import { InspectorGroup } from "../../pages/forms/builder/kit/InspectorGroup";
import { Checkbox } from "../../ui/Checkbox";
import { Select } from "../../ui/Select";
import { CheckboxField, Field, FieldGroup } from "../../ui/templates/Form";
import {
  formFieldsErrorReason,
  FormPickerError,
  FormPickerErrorReason,
} from "../FormPickerError";
import { BlockTextField } from "./BlockTextField";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

export function EditablePreviousAnswerBlock(
  props: BaseDisplayBlockProps<PreviousAnswerBlock>,
) {
  return (
    <DisplayBlockWrapper {...props}>
      {({ block, onUpdate }) => (
        <>
          <InspectorGroup>
            <BlockTextField
              label="Title"
              mark="optional"
              value={block.title ?? ""}
              onChange={(title) => onUpdate({ title })}
            />
            <BlockTextField
              label="Empty-state text"
              mark="optional"
              help="Shown when there's no answer to show."
              value={block.emptyText ?? ""}
              onChange={(emptyText) => onUpdate({ emptyText })}
              placeholder={DEFAULT_PREVIOUS_ANSWER_EMPTY_TEXT}
            />
          </InspectorGroup>
          <InspectorGroup title="Answer to show">
            <AnswerSource block={block} onUpdate={onUpdate} />
          </InspectorGroup>
        </>
      )}
    </DisplayBlockWrapper>
  );
}

function AnswerSource({
  block,
  onUpdate,
}: {
  block: PreviousAnswerBlock;
  onUpdate: (updates: Partial<PreviousAnswerBlock>) => void;
}) {
  const { options: forms, isError: formListFailed } = useFormOptions();
  const { fields: sourceFields, status: sourceStatus } = useFormQuestionFields(
    block.sourceFormId,
  );
  const sourceFormError = formFieldsErrorReason(sourceStatus);
  const selectedField = sourceFields.find((f) => f.id === block.sourceFieldId);
  const listSubFields =
    selectedField?.kind === "list" ? selectedField.fields : [];
  const shownSubFields =
    block.visibleSubFieldIds && block.visibleSubFieldIds.length > 0
      ? block.visibleSubFieldIds
      : listSubFields.map((f) => f.id);

  const setSubFieldShown = (id: string, shown: boolean) => {
    const next = shown
      ? [...shownSubFields, id]
      : shownSubFields.filter((shownId) => shownId !== id);
    onUpdate({
      visibleSubFieldIds: next.length === listSubFields.length ? [] : next,
    });
  };

  return (
    <>
      <Field label="Source form">
        {(control) => (
          <>
            <Select
              {...control}
              value={block.sourceFormId || ""}
              onChange={(event) =>
                onUpdate({
                  sourceFormId: Number(event.target.value),
                  sourceFieldId: "",
                  visibleSubFieldIds: [],
                })
              }
            >
              <option value="">Select a form…</option>
              {forms.map((f) => (
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
      {block.sourceFormId > 0 && (
        <Field label="Source field">
          {(control) => (
            <>
              <Select
                {...control}
                value={block.sourceFieldId || ""}
                onChange={(event) =>
                  onUpdate({
                    sourceFieldId: event.target.value,
                    visibleSubFieldIds: [],
                  })
                }
              >
                <option value="">Select a field…</option>
                {sourceFields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {fieldPickerLabel(f)}
                  </option>
                ))}
              </Select>
              {sourceFormError && <FormPickerError reason={sourceFormError} />}
            </>
          )}
        </Field>
      )}
      <CheckboxField
        label="Show field label when rendering"
        checked={block.showLabel ?? true}
        onChange={(event) => onUpdate({ showLabel: event.target.checked })}
      />
      {listSubFields.length > 0 && (
        <FieldGroup label="Visible sub-fields">
          {listSubFields.map((subField) => (
            <label key={subField.id} className="flex items-center gap-2.5">
              <Checkbox
                checked={shownSubFields.includes(subField.id)}
                onChange={(event) =>
                  setSubFieldShown(subField.id, event.target.checked)
                }
              />
              {fieldPickerLabel(subField)}
            </label>
          ))}
        </FieldGroup>
      )}
    </>
  );
}
