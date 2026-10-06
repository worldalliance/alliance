import { getRangeValues } from "@alliance/common/forms/range";
import { useState } from "react";
import { SelectedCountConditionValue } from "./SelectedCountConditionValue";
import {
  FieldComparison,
  type ControllerField,
  type FieldCondition,
} from "./fieldConditions";
import { INPUT_CLASS } from "./styles";

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
    <select
      aria-label="Value"
      className={INPUT_CLASS}
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
    </select>
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
    <div className="space-y-1">
      <input
        type="text"
        aria-label="Value"
        placeholder={formulaChoices ? "Choice value" : "Answer"}
        className={INPUT_CLASS}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <p
        className={
          value === ""
            ? "text-[11px] text-red-600"
            : "text-[11px] text-gray-500"
        }
      >
        {value === ""
          ? "Type the value to match."
          : formulaChoices
            ? "This question's choices come from a formula, so its value is typed."
            : "Matches this exact answer."}
      </p>
    </div>
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
    <input
      type="number"
      aria-label="Value"
      className={INPUT_CLASS}
      step={controller.step !== undefined ? String(controller.step) : "any"}
      min={controller.min}
      max={controller.max}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        const n =
          event.target.value.trim() === "" ? NaN : Number(event.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => setDraft(String(value))}
    />
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
    <select
      aria-label="Value"
      className={INPUT_CLASS}
      value={String(value)}
      onChange={(event) => onChange(event.target.value === "true")}
    >
      <option value="true">{labels.true}</option>
      <option value="false">{labels.false}</option>
    </select>
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
