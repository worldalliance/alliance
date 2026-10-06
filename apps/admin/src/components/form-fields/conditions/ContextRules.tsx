import {
  DEVICE_VISIBILITY_TARGETS,
  type DeviceVisibilityTarget,
} from "@alliance/common/forms/device";
import {
  USER_VALUE_PROPERTIES,
  USER_VALUE_PROPERTY_LABELS,
} from "@alliance/common/forms/user-properties";
import type { Condition } from "@alliance/common/forms/visible-if-formula";
import { INPUT_CLASS } from "./styles";

type ConditionOf<K extends Condition["kind"]> = Extract<Condition, { kind: K }>;

type RuleProps<K extends Condition["kind"]> = {
  condition: ConditionOf<K>;
  onChange: (condition: ConditionOf<K>) => void;
};

const LABEL_CLASS = "block text-xs text-gray-700 mb-1";

const DEVICE_LABELS: Record<DeviceVisibilityTarget, string> = {
  mobile: "Mobile",
  tablet: "Tablet",
  desktop: "Desktop",
};

function SetSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <select
      aria-label={label}
      className={INPUT_CLASS}
      value={String(value)}
      onChange={(event) => onChange(event.target.value === "true")}
    >
      <option value="true">is set</option>
      <option value="false">is not set</option>
    </select>
  );
}

/** Format an ISO datetime for a datetime-local input (local wall-clock). */
function isoToDatetimeLocalValue(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(
    parsed.getDate(),
  )}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

export function DeviceRule({ condition, onChange }: RuleProps<"deviceType">) {
  const selected = new Set(condition.deviceType);
  return (
    <div className="space-y-1">
      <span className={LABEL_CLASS}>Show on device types</span>
      {DEVICE_VISIBILITY_TARGETS.map((target) => (
        <label key={target} className="flex items-center text-xs text-gray-700">
          <input
            type="checkbox"
            className="mr-2"
            checked={selected.has(target)}
            onChange={(event) => {
              const next = new Set(selected);
              if (event.target.checked) next.add(target);
              else next.delete(target);
              onChange({
                ...condition,
                deviceType: DEVICE_VISIBILITY_TARGETS.filter((t) =>
                  next.has(t),
                ),
              });
            }}
          />
          {DEVICE_LABELS[target]}
        </label>
      ))}
      {selected.size === 0 && (
        <p className="text-[11px] text-red-500">
          Select at least one device type to make this rule effective.
        </p>
      )}
    </div>
  );
}

export function UserHasCityRule({
  condition,
  onChange,
}: RuleProps<"userHasCity">) {
  return (
    <SetSelect
      label="The user's city"
      value={condition.userHasCity}
      onChange={(userHasCity) => onChange({ ...condition, userHasCity })}
    />
  );
}

export function UserPropertyRule({
  condition,
  onChange,
}: RuleProps<"userPropertyHasValue">) {
  return (
    <div className="space-y-2">
      <select
        aria-label="User property"
        className={INPUT_CLASS}
        value={condition.property}
        onChange={(event) => {
          const property = USER_VALUE_PROPERTIES.find(
            (value) => value === event.target.value,
          );
          if (property) onChange({ ...condition, property });
        }}
      >
        {USER_VALUE_PROPERTIES.map((property) => (
          <option key={property} value={property}>
            {USER_VALUE_PROPERTY_LABELS[property]}
          </option>
        ))}
      </select>
      <SetSelect
        label="Property state"
        value={condition.hasValue}
        onChange={(hasValue) => onChange({ ...condition, hasValue })}
      />
    </div>
  );
}

export function FirstContractSignedRule({
  condition,
  onChange,
}: RuleProps<"firstContractSigned">) {
  return (
    <div className="space-y-2">
      <select
        aria-label="Signed"
        className={INPUT_CLASS}
        value={condition.comparison}
        onChange={(event) =>
          onChange({
            ...condition,
            comparison:
              event.target.value === "onOrAfter" ? "onOrAfter" : "before",
          })
        }
      >
        <option value="before">before</option>
        <option value="onOrAfter">on or after</option>
      </select>
      <input
        type="datetime-local"
        aria-label="Date"
        className={INPUT_CLASS}
        value={isoToDatetimeLocalValue(condition.date)}
        onChange={(event) => {
          const parsed = new Date(event.target.value);
          if (Number.isNaN(parsed.getTime())) return;
          onChange({ ...condition, date: parsed.toISOString() });
        }}
      />
      <p className="text-[11px] text-gray-400">
        Shown in your local timezone. Users who have never signed a contract
        match neither option.
      </p>
    </div>
  );
}

export function CompletedActionsRule({
  condition,
  onChange,
}: RuleProps<"completedActionCount">) {
  return (
    <label className="flex items-center gap-2 text-xs text-gray-700">
      At least
      <input
        type="number"
        min={0}
        step={1}
        aria-label="Completed actions"
        className={INPUT_CLASS}
        value={condition.atLeast}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          if (Number.isNaN(parsed) || parsed < 0) return;
          onChange({ ...condition, atLeast: parsed });
        }}
      />
      actions
    </label>
  );
}

export type OutputBlockOption = { id: string; label: string };

export function OutputBlockRule({
  condition,
  onChange,
  outputBlocks,
  selfId,
}: RuleProps<"outputBlockVisible"> & {
  outputBlocks: OutputBlockOption[];
  selfId: string | undefined;
}) {
  const referencedId = condition.outputBlockVisible;
  const isMissing =
    referencedId.length > 0 && !outputBlocks.some((b) => b.id === referencedId);
  return (
    <div className="space-y-2">
      <select
        aria-label="Output block"
        className={INPUT_CLASS}
        value={referencedId}
        onChange={(event) =>
          onChange({ ...condition, outputBlockVisible: event.target.value })
        }
      >
        {isMissing && (
          <option value={referencedId}>Missing block ({referencedId})</option>
        )}
        {outputBlocks.map((b) => (
          <option key={b.id} value={b.id} disabled={b.id === selfId}>
            ({b.id}) {b.label}
            {b.id === selfId ? " (current block)" : ""}
          </option>
        ))}
      </select>
      {isMissing && (
        <p className="text-[11px] text-red-500">
          Referenced block was deleted. Pick another block or remove this rule.
        </p>
      )}
      <select
        aria-label="Block visibility"
        className={INPUT_CLASS}
        value={String(condition.isVisible ?? true)}
        onChange={(event) =>
          onChange({ ...condition, isVisible: event.target.value === "true" })
        }
      >
        <option value="true">is visible in this output view</option>
        <option value="false">is hidden in this output view</option>
      </select>
    </div>
  );
}
