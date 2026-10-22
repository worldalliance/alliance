import type { FormSchema } from "@alliance/common/forms/form-schema";
import { rowFieldNames } from "@alliance/common/forms/row-list";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useState } from "react";
import {
  conditionableItems,
  parseRowsJson,
  withRowCondition,
} from "../../lib/rowListEdits";
import { inputPad } from "../VariableSamples";
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
    <div className="max-w-4xl mx-auto space-y-6">
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">Rows</h2>
        <p className="text-xs text-gray-600">
          Each member is given one row, the one fewest members hold, and keeps
          it. Use a row&apos;s values in text, labels, prefilled answers and
          link URLs as <code>#{"{row.field}"}</code>. Members never see the list
          itself.
        </p>
        <textarea
          aria-label="Rows as JSON"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={12}
          spellCheck={false}
          placeholder='[{ "jurisdiction": "Springfield", "email": null }]'
          className={cn(inputPad, "font-mono text-xs")}
        />
        {parseError && <p className="text-xs text-red-600">{parseError}</p>}
        <div className="flex items-center gap-2">
          <Button
            color={ButtonColor.Blue}
            onClick={applyRows}
            disabled={!edited}
          >
            Use these rows
          </Button>
          {list && (
            <Button
              color={ButtonColor.RedOutline}
              onClick={() => {
                const { rowList: _removed, ...rest } = schema;
                onSchemaChange(rest);
                setText("");
              }}
            >
              Remove the row list
            </Button>
          )}
          {list && (
            <span className="text-xs text-gray-500">
              {list.rows.length} rows
            </span>
          )}
        </div>
      </section>

      {list && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900">
            Fields that identify a row
          </h2>
          <p className="text-xs text-gray-600">
            Together they must be unique. Editing a row&apos;s other fields
            later reaches the members who already hold it.
          </p>
          <div className="flex flex-wrap gap-3">
            {fields.map((field) => (
              <label key={field} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={list.keyFields.includes(field)}
                  onChange={() => toggleKeyField(field)}
                />
                <code>{field}</code>
              </label>
            ))}
          </div>
        </section>
      )}

      {list && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900">
            Show only for some rows
          </h2>
          <div className="divide-y divide-gray-200 border border-gray-200 rounded bg-white">
            {conditionableItems(schema).map((item) => (
              <div key={`${item.where}:${item.id}`} className="p-3 space-y-1">
                <div className="text-xs text-gray-500">{item.where}</div>
                <div className="text-sm text-gray-900">{item.label}</div>
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
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
