import { getRangeValues } from "@alliance/common/forms/range";
import { useState } from "react";
import { Input } from "../../../../ui/Input";
import { Select } from "../../../../ui/Select";
import { Field } from "../../../../ui/templates/Form";
import { SelectedCountConditionValue } from "./SelectedCountConditionValue";
import {
  FieldComparison,
  type ControllerField,
  type FieldCondition,
} from "./fieldConditions";

type Literal = string | number | boolean | null;

function OptionValue({
  options,
  value,
  onChange,
}: {
  options: readonly { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const known = options.some((option) => option.value === value);
  return (
    <Field label="Value">
      {(control) => (
        <Select
          {...control}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {!known && (
            <option value={value}>
              {value === "" ? "Choose an option" : `Missing option (${value})`}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

function TypedValue({
  value,
  formulaChoices,
  onChange,
}: {
  value: string;
  formulaChoices: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Field
      label="Value"
      help={
        formulaChoices
          ? "This question's choices come from a formula, so its value is typed."
          : "Matches this exact answer."
      }
      error={value === "" ? "Type the value to match" : null}
    >
      {(control) => (
        <Input
          {...control}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </Field>
  );
}

function NumberValue({
  controller,
  value,
  onChange,
}: {
  controller: Extract<ControllerField, { kind: "number" }>;
  value: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setDraft(String(value));
  }
  return (
    <Field label="Value">
      {(control) => (
        <Input
          {...control}
          type="number"
          step={controller.step !== undefined ? String(controller.step) : "any"}
          min={controller.min}
          max={controller.max}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            const n =
              event.target.value.trim() === ""
                ? NaN
                : Number(event.target.value);
            if (Number.isFinite(n)) onChange(n);
          }}
          onBlur={() => setDraft(String(value))}
        />
      )}
    </Field>
  );
}

function BooleanValue({
  labels,
  value,
  onChange,
}: {
  labels: { true: string; false: string };
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Field label="Value">
      {(control) => (
        <Select
          {...control}
          value={String(value)}
          onChange={(event) => onChange(event.target.value === "true")}
        >
          <option value="true">{labels.true}</option>
          <option value="false">{labels.false}</option>
        </Select>
      )}
    </Field>
  );
}

function EqualsValue({
  controller,
  value,
  onChange,
}: {
  controller: ControllerField;
  value: Literal;
  onChange: (value: Literal) => void;
}) {
  switch (controller.kind) {
    case "checkbox":
      return (
        <BooleanValue
          labels={{ true: "Checked", false: "Unchecked" }}
          value={value === true}
          onChange={onChange}
        />
      );
    case "toggle":
      return (
        <BooleanValue
          labels={{ true: "On", false: "Off" }}
          value={value === true}
          onChange={onChange}
        />
      );
    case "contract":
      return (
        <BooleanValue
          labels={{
            true: controller.yesLabel?.trim() || "Yes",
            false: controller.noLabel?.trim() || "No",
          }}
          value={value !== false}
          onChange={onChange}
        />
      );
    case "number":
      return (
        <NumberValue
          controller={controller}
          value={typeof value === "number" ? value : 0}
          onChange={onChange}
        />
      );
    case "range":
      return (
        <OptionValue
          options={getRangeValues(controller).map((n) => ({
            label: String(n),
            value: String(n),
          }))}
          value={String(value ?? "")}
          onChange={(next) => onChange(Number(next))}
        />
      );
    case "radio":
    case "conversation":
      return (
        <OptionValue
          options={controller.options}
          value={String(value ?? "")}
          onChange={onChange}
        />
      );
    case "select":
    case "multiselect":
      return controller.optionsFormula ? (
        <TypedValue
          value={String(value ?? "")}
          formulaChoices
          onChange={onChange}
        />
      ) : (
        <OptionValue
          options={controller.options ?? []}
          value={String(value ?? "")}
          onChange={onChange}
        />
      );
    case "text":
    case "textarea":
    case "email":
    case "phone":
    case "custom":
      return (
        <TypedValue
          value={String(value ?? "")}
          formulaChoices={false}
          onChange={onChange}
        />
      );
    default:
      throw new Error(
        `unknown controller kind: ${JSON.stringify(controller satisfies never)}`,
      );
  }
}

/** The value input a comparison takes, or nothing for one that takes none. */
export function FieldRuleValue({
  comparison,
  controller,
  condition,
  onChange,
}: {
  comparison: FieldComparison;
  controller: ControllerField;
  condition: FieldCondition;
  onChange: (condition: FieldCondition) => void;
}) {
  switch (comparison) {
    case FieldComparison.Is:
    case FieldComparison.IsNot:
      if (condition.kind !== "equals") return null;
      return (
        <EqualsValue
          controller={controller}
          value={condition.equals}
          onChange={(equals) => onChange({ ...condition, equals })}
        />
      );
    case FieldComparison.Includes:
    case FieldComparison.Excludes:
      if (condition.kind !== "includesOption") return null;
      return (
        <EqualsValue
          controller={controller}
          value={condition.includesOption}
          onChange={(value) =>
            onChange({ ...condition, includesOption: String(value) })
          }
        />
      );
    case FieldComparison.SelectedCount:
      if (condition.kind !== "selectedCount") return null;
      return (
        <SelectedCountConditionValue
          comparison={condition.comparison}
          count={condition.count}
          onChange={({ comparison: next, count }) =>
            onChange({ ...condition, comparison: next, count })
          }
        />
      );
    case FieldComparison.AnySelected:
    case FieldComparison.NoneSelected:
    case FieldComparison.Answered:
    case FieldComparison.Unanswered:
      return null;
    default:
      throw new Error(`unknown comparison: ${comparison satisfies never}`);
  }
}
