import { elementInternalDescriptor } from "@alliance/common/forms/element-descriptors";
import type { ListField } from "@alliance/common/forms/form-schema";
import { InspectorGroup } from "../kit/InspectorGroup";
import { ItemList, ItemRow } from "../kit/ItemList";
import { Input } from "../../../../ui/Input";
import { Select } from "../../../../ui/Select";
import { CheckboxField, Field } from "../../../../ui/templates/Form";
import { describeElement, subFieldChild } from "../selection/canvasSelection";
import { neighborMoves, useSelectChild } from "../inspector/ChildRows";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import { ListPrefillSettings } from "./ListPrefillSettings";
import {
  createDefaultSubField,
  SUB_FIELD_KINDS,
  type SubFieldKind,
} from "./listSubFields";
import type { BaseFieldProps } from "./types";

const kindName = (kind: string) => kind.charAt(0).toUpperCase() + kind.slice(1);

export function EditableListField({
  field,
  onUpdate,
  previousFields,
  laterFields,
}: BaseFieldProps<ListField>) {
  const selectChild = useSelectChild();
  const subFields = field.fields ?? [];
  const hiddenIds = field.outputViewHiddenFieldIds ?? [];

  const addSubField = (kind: SubFieldKind) => {
    const sub = createDefaultSubField(field.id, kind);
    onUpdate({ fields: [...subFields, sub] });
    selectChild(subFieldChild(sub, subFields.length), { focus: true });
  };

  return (
    <FieldWrapper
      field={field}
      onUpdate={onUpdate}
      previousFields={previousFields}
      laterFields={laterFields}
    >
      <InspectorGroup>
        <FieldLabelEditor
          label="Question"
          value={field.label}
          onChange={(value) => onUpdate({ label: value })}
        />
        <Field label="Add item button text">
          {(control) => (
            <Input
              {...control}
              value={field.addButtonLabel ?? ""}
              onChange={(event) =>
                onUpdate({ addButtonLabel: event.target.value || undefined })
              }
              placeholder="Add item"
            />
          )}
        </Field>
        <Field label="Default number of cards">
          {(control) => (
            <Input
              {...control}
              type="number"
              min={0}
              value={field.defaultNumber ?? 0}
              onChange={(event) =>
                onUpdate({
                  defaultNumber: event.target.value
                    ? parseInt(event.target.value, 10)
                    : 0,
                })
              }
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min cards">
            {(control) => (
              <Input
                {...control}
                type="number"
                min={0}
                value={field.min ?? 0}
                onChange={(event) => {
                  const value = event.target.value
                    ? parseInt(event.target.value, 10)
                    : 0;
                  onUpdate({ min: value, required: value > 0 });
                }}
              />
            )}
          </Field>
          <Field label="Max cards">
            {(control) => (
              <Input
                {...control}
                type="number"
                min={0}
                value={field.max ?? ""}
                placeholder="No limit"
                onChange={(event) =>
                  onUpdate({
                    max: event.target.value
                      ? parseInt(event.target.value, 10)
                      : undefined,
                  })
                }
              />
            )}
          </Field>
        </div>
        <p className="-mt-2 text-caption text-fg-muted">
          A minimum above 0 makes the list required.
        </p>
      </InspectorGroup>

      <InspectorGroup title="Fields in each card">
        {subFields.length > 0 && (
          <ItemList label="Fields in each card">
            {subFields.map((sub, index) => {
              const name = describeElement(sub);
              return (
                <ItemRow
                  key={sub.id || index}
                  name={name}
                  {...neighborMoves(subFields, index, (fields) =>
                    onUpdate({ fields }),
                  )}
                  onRemove={() =>
                    onUpdate({
                      fields: subFields.filter((_, i) => i !== index),
                    })
                  }
                >
                  <button
                    type="button"
                    title={name}
                    onClick={() => selectChild(subFieldChild(sub, index))}
                    className="min-w-0 truncate rounded-sm py-1 text-left font-medium text-accent focus-ring hover:underline"
                  >
                    {name}
                  </button>
                </ItemRow>
              );
            })}
          </ItemList>
        )}
        <Select
          aria-label="Add field to card"
          value=""
          onChange={(event) => {
            const kind = SUB_FIELD_KINDS.find((k) => k === event.target.value);
            if (kind) addSubField(kind);
          }}
        >
          <option value="">+ Add field to card</option>
          {SUB_FIELD_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kindName(kind)}
            </option>
          ))}
        </Select>
      </InspectorGroup>

      {subFields.length > 0 && field.output?.output && (
        <InspectorGroup
          title="Output"
          description="Selected fields will not appear when this list is shown in output views."
        >
          {subFields.map((sub) => (
            <CheckboxField
              key={sub.id}
              label={`Hide ${elementInternalDescriptor(sub)} in output view`}
              checked={hiddenIds.includes(sub.id)}
              onChange={(event) => {
                const next = event.target.checked
                  ? [...hiddenIds, sub.id]
                  : hiddenIds.filter((id) => id !== sub.id);
                onUpdate({
                  outputViewHiddenFieldIds: next.length > 0 ? next : undefined,
                });
              }}
            />
          ))}
        </InspectorGroup>
      )}

      {subFields.length > 0 && (
        <ListPrefillSettings field={field} onUpdate={onUpdate} />
      )}
    </FieldWrapper>
  );
}
