import { useEffect, useState } from "react";
import type {
  AnyField,
  FieldKind,
  FormSchema,
  ListField,
} from "@alliance/shared/forms/formschema";
import { tasksListForms, tasksGetForm } from "@alliance/shared/client";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";
import { EditableCheckboxField } from "./EditableCheckboxField";
import { EditableChoiceField } from "./EditableChoiceField";
import { EditableCityField } from "./EditableCityField";
import { EditableDateField } from "./EditableDateField";
import { EditableEmailField } from "./EditableEmailField";
import { EditableFileField } from "./EditableFileField";
import { EditableNumberField } from "./EditableNumberField";
import { EditablePhoneField } from "./EditablePhoneField";
import { EditableRangeField } from "./EditableRangeField";
import { EditableTextField } from "./EditableTextField";
import { EditableTextareaField } from "./EditableTextareaField";
import { EditableTimeField } from "./EditableTimeField";
import { EditableTimezoneField } from "./EditableTimezoneField";

type FormListItem = { id: number; title: string };

const SUB_FIELD_KINDS_OPTIONS = {
  textarea: true,
  number: true,
  email: true,
  phone: true,
  checkbox: true,
  radio: true,
  select: true,
  multiselect: true,
  date: true,
  time: true,
  timezone: true,
  city: true,
  file: true,
  range: true,
} as const satisfies Record<
  Exclude<FieldKind, "list" | "contract" | "custom" | "text">,
  unknown
>;
type SubFieldKind = keyof typeof SUB_FIELD_KINDS_OPTIONS;

const SUB_FIELD_KINDS = Object.keys(SUB_FIELD_KINDS_OPTIONS) as SubFieldKind[];

function createDefaultSubField(parentId: string, kind: SubFieldKind): AnyField {
  const id = `${parentId}-sub-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
  const base = {
    id,
    kind,
    label: `${kind.charAt(0).toUpperCase() + kind.slice(1)}`,
    required: false,
  };
  switch (kind) {
    case "textarea":
      return { ...base, kind: "textarea", rows: 1 };
    case "number":
      return { ...base, kind: "number" };
    case "email":
      return { ...base, kind: "email" };
    case "phone":
      return { ...base, kind: "phone", placeholder: "Enter phone number" };
    case "checkbox":
      return { ...base, kind: "checkbox" };
    case "radio":
      return {
        ...base,
        kind: "radio",
        options: [{ label: "Option 1", value: "option1" }],
      };
    case "select":
      return {
        ...base,
        kind: "select",
        options: [{ label: "Option 1", value: "option1" }],
      };
    case "multiselect":
      return {
        ...base,
        kind: "multiselect",
        options: [{ label: "Option 1", value: "option1" }],
      };
    case "date":
      return { ...base, kind: "date" };
    case "time":
      return { ...base, kind: "time" };
    case "timezone":
      return {
        ...base,
        kind: "timezone",
        defaultValue: "America/Los_Angeles",
      };
    case "city":
      return { ...base, kind: "city", placeholder: "Search for a city" };
    case "file":
      return { ...base, kind: "file" };
    case "range":
      return {
        ...base,
        kind: "range",
        optionCount: 10,
        startLabel: "",
        endLabel: "",
      };
    default:
      kind satisfies never;
      return { ...base, kind: "textarea", rows: 1 };
  }
}

function renderEditableSubField(
  sub: AnyField,
  index: number,
  updateSubField: (index: number, updates: Partial<AnyField>) => void,
  removeSubField: (index: number) => void,
  previousFields: AnyField[]
) {
  const commonProps = {
    field: sub as never,
    onUpdate: (updates: Partial<AnyField>) => updateSubField(index, updates),
    onRemove: () => removeSubField(index),
    previousFields,
    onDragStart: undefined,
    onDragEnd: undefined,
    isDragging: false,
  };
  switch (sub.kind) {
    case "text":
      return <EditableTextField {...commonProps} />;
    case "textarea":
      return <EditableTextareaField {...commonProps} />;
    case "email":
      return <EditableEmailField {...commonProps} />;
    case "phone":
      return <EditablePhoneField {...commonProps} />;
    case "number":
      return <EditableNumberField {...commonProps} />;
    case "range":
      return <EditableRangeField {...commonProps} />;
    case "checkbox":
      return <EditableCheckboxField {...commonProps} />;
    case "radio":
    case "select":
    case "multiselect":
      return <EditableChoiceField {...commonProps} />;
    case "date":
      return <EditableDateField {...commonProps} />;
    case "time":
      return <EditableTimeField {...commonProps} />;
    case "timezone":
      return <EditableTimezoneField {...commonProps} />;
    case "city":
      return <EditableCityField {...commonProps} />;
    case "file":
      return <EditableFileField {...commonProps} />;
    default:
      return null;
  }
}

export function EditableListField({
  field,
  onUpdate,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  previousFields,
}: BaseFieldProps<ListField>) {
  // --- Prefill from previous answer state ---
  const [prefillForms, setPrefillForms] = useState<FormListItem[]>([]);
  const [prefillSourceFields, setPrefillSourceFields] = useState<AnyField[]>(
    []
  );

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
        setPrefillForms(mapped);
      })
      .catch(() => {
        // ignore
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch source form schema when sourceFormId changes
  const prefillSourceFormId = field.prefillFromPreviousAnswer?.sourceFormId;
  useEffect(() => {
    if (!prefillSourceFormId) {
      setPrefillSourceFields([]);
      return;
    }
    let cancelled = false;
    tasksGetForm({ path: { id: prefillSourceFormId } })
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
          setPrefillSourceFields(fields);
        }
      })
      .catch(() => {
        setPrefillSourceFields([]);
      });
    return () => {
      cancelled = true;
    };
  }, [prefillSourceFormId]);

  const prefillSourceListFields = prefillSourceFields.filter(
    (f) => f.kind === "list"
  ) as ListField[];
  const selectedSourceListField = prefillSourceListFields.find(
    (f) => f.id === field.prefillFromPreviousAnswer?.sourceFieldId
  );
  const sourceSubFields = selectedSourceListField?.fields ?? [];

  const addSubField = (kind: (typeof SUB_FIELD_KINDS)[number]) => {
    const sub = createDefaultSubField(field.id, kind);
    onUpdate({ fields: [...(field.fields ?? []), sub] });
  };

  const updateSubField = (index: number, updates: Partial<AnyField>) => {
    const next = [...(field.fields ?? [])];
    next[index] = { ...next[index], ...updates } as AnyField;
    onUpdate({ fields: next });
  };

  const removeSubField = (index: number) => {
    const next = (field.fields ?? []).filter((_, i) => i !== index);
    onUpdate({ fields: next });
  };

  const subFields = field.fields ?? [];
  const previousFieldsFor = (index: number) => subFields.slice(0, index);
  const hiddenIds = field.outputViewHiddenFieldIds ?? [];

  return (
    <FieldWrapper
      field={field}
      onUpdate={onUpdate}
      previousFields={previousFields}
      onRemove={onRemove}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      isDragging={isDragging}
    >
      <FieldLabelEditor
        value={field.label}
        onChange={(v) => onUpdate({ label: v })}
      />

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          “Add item” button text
        </label>
        <input
          type="text"
          value={field.addButtonLabel ?? ""}
          onChange={(e) =>
            onUpdate({ addButtonLabel: e.target.value || undefined })
          }
          placeholder="e.g. Add item (leave blank for default)"
          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs text-gray-700 mb-1">
            Default number of cards
          </label>
          <input
            type="number"
            value={field.defaultNumber ?? 0}
            onChange={(e) =>
              onUpdate({
                defaultNumber: e.target.value
                  ? parseInt(e.target.value, 10)
                  : 0,
              })
            }
            min={0}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">Min cards</label>
          <input
            type="number"
            value={field.min ?? 0}
            onChange={(e) => {
              const value = e.target.value ? parseInt(e.target.value, 10) : 0;
              onUpdate({
                min: value,
                required: value > 0,
              });
            }}
            min={0}
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-700 mb-1">Max cards</label>
          <input
            type="number"
            value={field.max ?? ""}
            onChange={(e) =>
              onUpdate({
                max: e.target.value ? parseInt(e.target.value, 10) : undefined,
              })
            }
            min={0}
            placeholder="No limit"
            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Fields in each card
        </label>
        <div className="space-y-3">
          {subFields.map((sub, index) => (
            <div key={sub.id}>
              {renderEditableSubField(
                sub,
                index,
                updateSubField,
                removeSubField,
                previousFieldsFor(index)
              )}
            </div>
          ))}
          <div className="relative">
            <select
              value=""
              onChange={(e) => {
                const k = e.target.value as (typeof SUB_FIELD_KINDS)[number];
                if (k) addSubField(k);
                e.target.value = "";
              }}
              className="w-full px-2 py-1.5 text-sm border border-dashed border-gray-300 rounded bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none pr-8"
            >
              <option value="">+ Add field to card</option>
              {SUB_FIELD_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k.charAt(0).toUpperCase() + k.slice(1)}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
              +
            </span>
          </div>
        </div>
      </div>

      {subFields.length > 0 && field.output?.output && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Hide in output view
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Selected fields will not appear when this list is shown in output
            views.
          </p>
          <div className="space-y-1.5">
            {subFields.map((sub) => {
              const isHidden = hiddenIds.includes(sub.id);
              return (
                <label
                  key={sub.id}
                  className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isHidden}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...hiddenIds, sub.id]
                        : hiddenIds.filter((id) => id !== sub.id);
                      onUpdate({
                        outputViewHiddenFieldIds:
                          next.length > 0 ? next : undefined,
                      });
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>{sub.label || sub.id}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Prefill from previous answer */}
      {subFields.length > 0 && (
        <div className="border-t border-gray-200 pt-3 space-y-2">
          <label className="block text-xs font-medium text-gray-700">
            Prefill from previous answer
          </label>
          <p className="text-xs text-gray-500">
            Pre-populate this list with items from a previously submitted list
            field.
          </p>

          {/* Source Form */}
          <div>
            <label className="block text-xs text-gray-700 mb-1">
              Source Form
            </label>
            <select
              value={field.prefillFromPreviousAnswer?.sourceFormId ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  onUpdate({ prefillFromPreviousAnswer: undefined });
                } else {
                  onUpdate({
                    prefillFromPreviousAnswer: {
                      sourceFormId: Number(val),
                      sourceFieldId: "",
                      sourceSubFieldId: "",
                      targetSubFieldId: "",
                    },
                  });
                }
              }}
              className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">None</option>
              {prefillForms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title} (#{f.id})
                </option>
              ))}
            </select>
          </div>

          {/* Source List Field */}
          {field.prefillFromPreviousAnswer?.sourceFormId && (
            <div>
              <label className="block text-xs text-gray-700 mb-1">
                Source List Field
              </label>
              <select
                value={field.prefillFromPreviousAnswer?.sourceFieldId ?? ""}
                onChange={(e) => {
                  onUpdate({
                    prefillFromPreviousAnswer: {
                      ...field.prefillFromPreviousAnswer!,
                      sourceFieldId: e.target.value,
                      sourceSubFieldId: "",
                      targetSubFieldId: "",
                    },
                  });
                }}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select a list field...</option>
                {prefillSourceListFields.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label} ({f.kind})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Source Sub-field */}
          {field.prefillFromPreviousAnswer?.sourceFieldId &&
            sourceSubFields.length > 0 && (
              <div>
                <label className="block text-xs text-gray-700 mb-1">
                  Source Sub-field (to read from)
                </label>
                <select
                  value={
                    field.prefillFromPreviousAnswer?.sourceSubFieldId ?? ""
                  }
                  onChange={(e) => {
                    onUpdate({
                      prefillFromPreviousAnswer: {
                        ...field.prefillFromPreviousAnswer!,
                        sourceSubFieldId: e.target.value,
                        targetSubFieldId: "",
                      },
                    });
                  }}
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a sub-field...</option>
                  {sourceSubFields.map((sf) => (
                    <option key={sf.id} value={sf.id}>
                      {sf.label} ({sf.kind})
                    </option>
                  ))}
                </select>
              </div>
            )}

          {/* Target Sub-field */}
          {field.prefillFromPreviousAnswer?.sourceSubFieldId && (
            <div>
              <label className="block text-xs text-gray-700 mb-1">
                Target Sub-field (to write into)
              </label>
              <select
                value={field.prefillFromPreviousAnswer?.targetSubFieldId ?? ""}
                onChange={(e) => {
                  onUpdate({
                    prefillFromPreviousAnswer: {
                      ...field.prefillFromPreviousAnswer!,
                      targetSubFieldId: e.target.value,
                    },
                  });
                }}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select a sub-field...</option>
                {subFields.map((sf) => (
                  <option key={sf.id} value={sf.id}>
                    {sf.label} ({sf.kind})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </FieldWrapper>
  );
}
