import { useEffect, useState } from "react";
import type { PreviousAnswerBlock } from "@alliance/shared/forms/display-blocks";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";
import { tasksListForms, tasksGetForm } from "@alliance/shared/client";
import type {
  AnyField,
  FormSchema,
  ListField,
} from "@alliance/shared/forms/formschema";

type FormListItem = { id: number; title: string };

export function EditablePreviousAnswerBlock({
  block,
  onUpdate,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  previousFields,
}: BaseDisplayBlockProps<PreviousAnswerBlock>) {
  const [forms, setForms] = useState<FormListItem[]>([]);
  const [sourceFields, setSourceFields] = useState<AnyField[]>([]);

  // Load list of forms on mount
  useEffect(() => {
    let cancelled = false;
    tasksListForms()
      .then((response) => {
        if (cancelled) return;
        const items = (response.data ?? []) as Array<{
          id: number;
          title?: string;
        }>;
        const mapped = items.map((f) => ({
          id: f.id,
          title: f.title ?? `Form ${f.id}`,
        }));
        mapped.sort((a, b) => b.id - a.id);
        setForms(mapped);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch form schema when sourceFormId changes
  useEffect(() => {
    if (!block.sourceFormId) {
      setSourceFields([]);
      return;
    }
    let cancelled = false;
    tasksGetForm({ path: { id: block.sourceFormId } })
      .then((response) => {
        if (cancelled) return;
        if (response.data) {
          const form = response.data as Record<string, unknown>;
          const schema = form.schema as FormSchema;
          const fields: AnyField[] = [];
          for (const page of schema.pages ?? []) {
            for (const element of page.fields ?? []) {
              if ("label" in element) {
                fields.push(element as AnyField);
              }
            }
          }
          setSourceFields(fields);
        }
      })
      .catch(() => {
        setSourceFields([]);
      });
    return () => {
      cancelled = true;
    };
  }, [block.sourceFormId]);

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
      previousFields={previousFields}
    >
      {({ block: activeBlock, onUpdate: handleUpdate }) => (
        <div className="space-y-3">
          <div className="font-medium">Previous Answer Block</div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title (optional)
            </label>
            <input
              type="text"
              value={activeBlock.title ?? ""}
              onChange={(e) => handleUpdate({ title: e.target.value })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Display title"
            />
          </div>

          {/* Empty text */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Empty state text (optional)
            </label>
            <input
              type="text"
              value={activeBlock.emptyText ?? ""}
              onChange={(e) => handleUpdate({ emptyText: e.target.value })}
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
                    {f.label} ({f.kind})
                  </option>
                ))}
              </select>
            </div>
          )}

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
                      {subField.label} ({subField.kind})
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
