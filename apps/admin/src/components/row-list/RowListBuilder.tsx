import type { FormSchema } from "@alliance/common/forms/form-schema";
import { rowFieldNames } from "@alliance/common/forms/row-list";
import { useState } from "react";
import {
  conditionableItems,
  parseRowsJson,
  withRowCondition,
} from "../../lib/rowListEdits";
import Button, { ButtonVariant } from "../../ui/Button";
import { Textarea } from "../../ui/Textarea";
import {
  CheckboxField,
  Field,
  FieldGroup,
  FormSection,
} from "../../ui/templates/Form";
import { RowConditionEditor } from "./RowConditionEditor";

const rowsText = (schema: FormSchema) =>
  schema.rowList ? JSON.stringify(schema.rowList.rows, null, 2) : "";

export function RowListBuilder({
  schema,
  onSchemaChange,
}: {
  schema: FormSchema;
  onSchemaChange: (next: FormSchema) => void;
}) {
  const [text, setText] = useState(() => rowsText(schema));
  const [parseError, setParseError] = useState<string | null>(null);
  const list = schema.rowList;
  const fields = list ? rowFieldNames(list) : [];
  const edited = text !== rowsText(schema);

  const applyRows = () => {
    const parsed = parseRowsJson(text, list?.keyFields ?? []);
    if (!parsed.ok) {
      setParseError(parsed.error);
      return;
    }
    setParseError(null);
    onSchemaChange({ ...schema, rowList: parsed.value });
  };

  const toggleKeyField = (field: string) => {
    if (!list) return;
    const keyFields = list.keyFields.includes(field)
      ? list.keyFields.filter((key) => key !== field)
      : [...list.keyFields, field];
    onSchemaChange({ ...schema, rowList: { ...list, keyFields } });
  };

  return (
    <div className="mx-auto flex w-full max-w-176 flex-col gap-section">
      <FormSection
        title="Row list"
        description={
          list
            ? `${list.rows.length} rows`
            : "Give each member one row of values to use in this form."
        }
      >
        <Field
          label="Rows (JSON)"
          help={
            <>
              Each member is given one row, the one fewest members hold, and
              keeps it. Use a row&apos;s values in text, labels, prefilled
              answers and link URLs as{" "}
              <code className="font-mono">#{"{row.field}"}</code>. Members never
              see the list itself.
            </>
          }
          error={parseError}
        >
          {(control) => (
            <Textarea
              {...control}
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={12}
              spellCheck={false}
              placeholder='[{ "jurisdiction": "Springfield", "email": null }]'
              className="font-mono text-xs"
            />
          )}
        </Field>
        <div className="flex items-center gap-2">
          <Button
            variant={ButtonVariant.Primary}
            onClick={applyRows}
            disabled={!edited}
          >
            Use these rows
          </Button>
          {list && (
            <Button
              variant={ButtonVariant.DangerOutline}
              onClick={() => {
                const { rowList: _removed, ...rest } = schema;
                onSchemaChange(rest);
                setText("");
              }}
            >
              Remove the row list
            </Button>
          )}
        </div>
        {list && (
          <FieldGroup
            label="Fields that identify a row"
            help="Together they must be unique. Editing a row's other fields later reaches the members who already hold it."
          >
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {fields.map((field) => (
                <CheckboxField
                  key={field}
                  label={field}
                  checked={list.keyFields.includes(field)}
                  onChange={() => toggleKeyField(field)}
                />
              ))}
            </div>
          </FieldGroup>
        )}
      </FormSection>

      {list && (
        <FormSection title="Show only for some rows">
          <ul className="flex flex-col divide-y divide-line">
            {conditionableItems(schema).map((item) => (
              <li
                key={`${item.where}:${item.id}`}
                className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-caption text-fg-muted">{item.where}</p>
                  <p className="font-medium">{item.label}</p>
                </div>
                <RowConditionEditor
                  itemLabel={item.label}
                  list={list}
                  fields={fields}
                  condition={item.rowCondition}
                  onChange={(condition) =>
                    onSchemaChange(
                      withRowCondition(schema, { itemId: item.id, condition }),
                    )
                  }
                />
              </li>
            ))}
          </ul>
        </FormSection>
      )}
    </div>
  );
}
