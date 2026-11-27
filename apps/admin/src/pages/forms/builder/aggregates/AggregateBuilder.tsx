import { fieldPickerLabel } from "@alliance/common/forms/element-descriptors";
import {
  isQuestionField,
  type AggregateViewDisplayType,
  type AggregateViewSchema,
  type AggregateViewValue,
  type AnyField,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import { useId, useMemo, useState } from "react";
import Button, { ButtonVariant } from "../../../../ui/Button";
import { EmptyState } from "../../../../ui/EmptyState";
import { Input } from "../../../../ui/Input";
import { Radio } from "../../../../ui/Radio";
import { Select } from "../../../../ui/Select";
import { Field, FieldGroup, FormSection } from "../../../../ui/templates/Form";

const collectFields = (schema: FormSchema): AnyField[] => {
  const result: AnyField[] = [];
  schema.pages.forEach((page) => {
    page.fields.forEach((field) => {
      if (isQuestionField(field)) {
        result.push(field);
      }
    });
  });
  return result;
};

const collectNumberFields = (schema: FormSchema): AnyField[] =>
  collectFields(schema).filter((field) => field.kind === "number");

const buildNewView = (schema: FormSchema): AggregateViewSchema => {
  const firstField = collectNumberFields(schema)[0];
  return {
    id: `aggregate-view-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`,
    kind: "progressbar",
    title: "Progress Bar",
    caption: "Progress:",
    numerator:
      firstField != null
        ? { type: "numberfield", fieldId: firstField.id }
        : { type: "number", value: 0 },
    denominator: { type: "number", value: 100 },
    displayType: "number",
  };
};

const DISPLAY_TYPES: { value: AggregateViewDisplayType; label: string }[] = [
  { value: "number", label: "Number" },
  { value: "dollars", label: "Dollars" },
];

/** Holds what is typed until it is committed on blur or Enter. */
function StaticNumber({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const raw = draft.trim();
    const parsed = raw === "" ? 0 : Number(raw);
    if (Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    setDraft(String(parsed));
    onCommit(parsed);
  };
  return (
    <Input
      type="number"
      aria-label={label}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

function ValueEditor({
  label,
  value,
  availableFields,
  onChange,
}: {
  label: string;
  value: AggregateViewValue;
  availableFields: AnyField[];
  onChange: (value: AggregateViewValue) => void;
}) {
  const firstField = availableFields[0];
  const name = `${label}-${useId()}`;
  return (
    <FieldGroup label={label}>
      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <Radio
            name={name}
            checked={value.type === "number"}
            onChange={() => onChange({ type: "number", value: 0 })}
          />
          Static number
        </label>
        <label className="flex items-center gap-2">
          <Radio
            name={name}
            checked={value.type === "numberfield"}
            disabled={!firstField}
            onChange={() =>
              firstField &&
              onChange({ type: "numberfield", fieldId: firstField.id })
            }
          />
          Number question
        </label>
      </div>
      {value.type === "number" ? (
        <StaticNumber
          key={value.value}
          label={`${label} value`}
          value={value.value}
          onCommit={(next) => onChange({ type: "number", value: next })}
        />
      ) : (
        <Select
          aria-label={`${label} question`}
          value={value.fieldId}
          onChange={(event) =>
            onChange({ type: "numberfield", fieldId: event.target.value })
          }
        >
          {availableFields.map((field) => (
            <option key={field.id} value={field.id}>
              {fieldPickerLabel(field)}
            </option>
          ))}
        </Select>
      )}
      {!firstField && (
        <p className="text-caption text-fg-muted">
          Add a number question to the form to use one here.
        </p>
      )}
    </FieldGroup>
  );
}

interface AggregateBuilderProps {
  schema: FormSchema;
  onSchemaChange: (schema: FormSchema) => void;
}

export function AggregateBuilder({
  schema,
  onSchemaChange,
}: AggregateBuilderProps) {
  const availableFields = useMemo(() => collectNumberFields(schema), [schema]);
  const views = schema.aggregateViews ?? [];

  const updateViews = (next: AggregateViewSchema[]) =>
    onSchemaChange({ ...schema, aggregateViews: next });

  const updateView = (viewId: string, updates: Partial<AggregateViewSchema>) =>
    updateViews(
      views.map((view) =>
        view.id === viewId ? { ...view, ...updates } : view,
      ),
    );

  const normalizeFieldValue = (
    value: AggregateViewValue,
  ): AggregateViewValue => {
    if (
      value.type !== "numberfield" ||
      availableFields.some((field) => field.id === value.fieldId)
    ) {
      return value;
    }
    const firstField = availableFields[0];
    return firstField
      ? { type: "numberfield", fieldId: firstField.id }
      : { type: "number", value: 0 };
  };

  return (
    <div className="mx-auto flex w-full max-w-176 flex-col gap-section">
      <div className="flex items-start justify-between gap-4">
        <p className="text-fg-muted">
          Summary visuals for the task, calculated from members' responses.
        </p>
        <Button onClick={() => updateViews([...views, buildNewView(schema)])}>
          Add aggregate view
        </Button>
      </div>
      {views.length === 0 && (
        <EmptyState
          title="No aggregate views yet"
          description="Add one to show a total from members' responses."
        />
      )}
      {views.map((view, index) => (
        <FormSection
          key={view.id}
          title={`View ${index + 1}`}
          actions={
            <Button
              variant={ButtonVariant.DangerOutline}
              onClick={() =>
                updateViews(views.filter((other) => other.id !== view.id))
              }
            >
              Remove view
            </Button>
          }
        >
          <Field label="Title">
            {(control) => (
              <Input
                {...control}
                value={view.title}
                onChange={(event) =>
                  updateView(view.id, { title: event.target.value })
                }
                placeholder="Progress title"
              />
            )}
          </Field>
          <Field label="Caption">
            {(control) => (
              <Input
                {...control}
                value={view.caption}
                onChange={(event) =>
                  updateView(view.id, { caption: event.target.value })
                }
                placeholder="Shown beside the totals"
              />
            )}
          </Field>
          <Field label="Display type">
            {(control) => (
              <Select
                {...control}
                value={view.displayType ?? "number"}
                onChange={(event) => {
                  const displayType = DISPLAY_TYPES.find(
                    (type) => type.value === event.target.value,
                  );
                  if (displayType)
                    updateView(view.id, { displayType: displayType.value });
                }}
              >
                {DISPLAY_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {(["numerator", "denominator"] as const).map((key) => (
            <ValueEditor
              key={key}
              label={key === "numerator" ? "Numerator" : "Denominator"}
              value={view[key]}
              availableFields={availableFields}
              onChange={(value) =>
                updateView(view.id, { [key]: normalizeFieldValue(value) })
              }
            />
          ))}
        </FormSection>
      ))}
    </div>
  );
}
