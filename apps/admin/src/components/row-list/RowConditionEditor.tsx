import { rowValueText } from "@alliance/common/forms/row-list";
import {
  RowConditionKind,
  type RowCondition,
  type RowList,
  type RowValue,
} from "@alliance/common/forms/row-list-schema";
import { cn } from "@alliance/shared/styles/util";
import { inputText } from "../VariableSamples";

const KIND_LABEL: Record<RowConditionKind, string> = {
  [RowConditionKind.Equals]: "is",
  [RowConditionKind.NotEquals]: "is not",
  [RowConditionKind.HasValue]: "has a value",
  [RowConditionKind.IsEmpty]: "is empty",
  [RowConditionKind.IsOneOf]: "is one of",
};

const ALWAYS = "";

const valueLabel = (value: RowValue) =>
  value === null ? "(empty)" : rowValueText(value);

function distinctValues(list: RowList, field: string): RowValue[] {
  const values = new Map<string, RowValue>();
  for (const row of list.rows) {
    const value = row[field] ?? null;
    values.set(JSON.stringify(value), value);
  }
  return [...values.values()];
}

function withKind(
  condition: RowCondition,
  kind: RowConditionKind,
  values: readonly RowValue[],
): RowCondition {
  const { field } = condition;
  const first = "value" in condition ? condition.value : (values[0] ?? null);
  switch (kind) {
    case RowConditionKind.Equals:
    case RowConditionKind.NotEquals:
      return { kind, field, value: first };
    case RowConditionKind.HasValue:
    case RowConditionKind.IsEmpty:
      return { kind, field };
    case RowConditionKind.IsOneOf:
      return { kind, field, values: [first] };
    default:
      throw new Error(`unknown row condition kind: ${kind satisfies never}`);
  }
}

export function RowConditionEditor({
  itemLabel,
  list,
  fields,
  condition,
  onChange,
}: {
  itemLabel: string;
  list: RowList;
  fields: readonly string[];
  condition: RowCondition | undefined;
  onChange: (next: RowCondition | undefined) => void;
}) {
  const values =
    condition === undefined ? [] : distinctValues(list, condition.field);
  const encoded = (value: RowValue) => JSON.stringify(value);
  const decode = (text: string): RowValue =>
    values.find((value) => encoded(value) === text) ?? null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={`Row field that decides whether ${itemLabel} shows`}
        value={condition?.field ?? ALWAYS}
        onChange={(event) => {
          const field = event.target.value;
          onChange(
            field === ALWAYS
              ? undefined
              : { kind: RowConditionKind.HasValue, field },
          );
        }}
        className={cn(inputText, "bg-white w-44")}
      >
        <option value={ALWAYS}>Every row</option>
        {fields.map((field) => (
          <option key={field} value={field}>
            Only when {field}
          </option>
        ))}
      </select>
      {condition && (
        <select
          aria-label={`Comparison for ${itemLabel}`}
          value={condition.kind}
          onChange={(event) => {
            const kind = Object.values(RowConditionKind).find(
              (candidate) => candidate === event.target.value,
            );
            if (kind) onChange(withKind(condition, kind, values));
          }}
          className={cn(inputText, "bg-white w-36")}
        >
          {Object.values(RowConditionKind).map((kind) => (
            <option key={kind} value={kind}>
              {KIND_LABEL[kind]}
            </option>
          ))}
        </select>
      )}
      {condition && "value" in condition && (
        <select
          aria-label={`Value for ${itemLabel}`}
          value={encoded(condition.value)}
          onChange={(event) =>
            onChange({ ...condition, value: decode(event.target.value) })
          }
          className={cn(inputText, "bg-white w-56")}
        >
          {values.map((value) => (
            <option key={encoded(value)} value={encoded(value)}>
              {valueLabel(value)}
            </option>
          ))}
        </select>
      )}
      {condition?.kind === RowConditionKind.IsOneOf && (
        <div className="flex flex-wrap gap-2">
          {values.map((value) => {
            const checked = condition.values.some(
              (chosen) => encoded(chosen) === encoded(value),
            );
            return (
              <label
                key={encoded(value)}
                className="flex items-center gap-1 text-xs"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    onChange({
                      ...condition,
                      values: checked
                        ? condition.values.filter(
                            (chosen) => encoded(chosen) !== encoded(value),
                          )
                        : [...condition.values, value],
                    })
                  }
                />
                {valueLabel(value)}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
