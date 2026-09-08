import type { PreviousAnswerBlock } from "@alliance/common/forms/display-blocks";
import { fieldPickerLabel } from "@alliance/common/forms/element-descriptors";
import type { ListField } from "@alliance/common/forms/form-schema";
import { useFormQuestionFields } from "@alliance/shared/lib/useFormSchema";
import { useFormOptions } from "@alliance/shared/lib/useFormsAdmin";
import {
  formFieldsErrorReason,
  FormPickerError,
  FormPickerErrorReason,
} from "../FormPickerError";
import { VariableTextField } from "../VariableTextField";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

export function EditablePreviousAnswerBlock({
  block,
  onUpdate,
  updateCurrent,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  previousFields,
}: BaseDisplayBlockProps<PreviousAnswerBlock>) {
  const { options: forms, isError: formListFailed } = useFormOptions();
  const { fields: sourceFields, status: sourceStatus } = useFormQuestionFields(
    block.sourceFormId,
  );
  const sourceFormError = formFieldsErrorReason(sourceStatus);

  const selectedField = sourceFields.find((f) => f.id === block.sourceFieldId);
  const isListField = selectedField?.kind === "list";
  const listSubFields = isListField ? (selectedField as ListField).fields : [];

  return (
    <DisplayBlockWrapper
      onRemove={onRemove}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      isDragging={isDragging}
      block={block}
      onUpdate={onUpdate}
      updateCurrent={updateCurrent}
      previousFields={previousFields}
    >
      {({ block: activeBlock, onUpdate: handleUpdate }) => (
        <div className="space-y-3">
          <div className="font-medium">Previous Answer Block</div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title (optional)
            </label>
            <VariableTextField
              value={activeBlock.title ?? ""}
              onChange={(title) => handleUpdate({ title })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Display title"
            />
          </div>

          {/* Empty text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Empty state text (optional)
            </label>
            <VariableTextField
              value={activeBlock.emptyText ?? ""}
              onChange={(emptyText) => handleUpdate({ emptyText })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="No previous answer available"
            />
          </div>

          {/* Form picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Source Form
            </label>
            <select
              value={activeBlock.sourceFormId || ""}
              onChange={(e) => {
                const formId = Number(e.target.value);
                handleUpdate({
                  sourceFormId: formId,
                  sourceFieldId: "",
                  visibleSubFieldIds: [],
                });
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select a form...</option>
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title} (#{f.id})
                </option>
              ))}
            </select>
            {formListFailed && (
              <FormPickerError
                reason={FormPickerErrorReason.FormList}
                className="mt-1"
              />
            )}
          </div>

          {/* Field picker */}
          {activeBlock.sourceFormId > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Source Field
              </label>
              <select
                value={activeBlock.sourceFieldId || ""}
                onChange={(e) =>
                  handleUpdate({
                    sourceFieldId: e.target.value,
                    visibleSubFieldIds: [],
                  })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select a field...</option>
                {sourceFields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {fieldPickerLabel(f)}
                  </option>
                ))}
              </select>
              {sourceFormError && (
                <FormPickerError reason={sourceFormError} className="mt-1" />
              )}
            </div>
          )}

          {/* Field label visibility */}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={activeBlock.showLabel ?? true}
              onChange={(e) => handleUpdate({ showLabel: e.target.checked })}
              className="h-4 w-4"
            />
            Show field label when rendering
          </label>

          {/* Sub-field visibility (list fields only) */}
          {isListField && listSubFields.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Visible sub-fields (uncheck to hide)
              </label>
              <div className="space-y-1">
                {listSubFields.map((subField) => {
                  const visible =
                    !activeBlock.visibleSubFieldIds ||
                    activeBlock.visibleSubFieldIds.length === 0 ||
                    activeBlock.visibleSubFieldIds.includes(subField.id);
                  return (
                    <label
                      key={subField.id}
                      className="flex items-center gap-2 text-sm text-gray-700"
                    >
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={(e) => {
                          const current =
                            activeBlock.visibleSubFieldIds &&
                            activeBlock.visibleSubFieldIds.length > 0
                              ? activeBlock.visibleSubFieldIds
                              : listSubFields.map((f) => f.id);
                          const next = e.target.checked
                            ? [...current, subField.id]
                            : current.filter((id) => id !== subField.id);
                          handleUpdate({
                            visibleSubFieldIds:
                              next.length === listSubFields.length ? [] : next,
                          });
                        }}
                        className="h-4 w-4"
                      />
                      {fieldPickerLabel(subField)}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </DisplayBlockWrapper>
  );
}
