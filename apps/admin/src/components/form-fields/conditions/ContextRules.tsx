import {
  DEVICE_VISIBILITY_TARGETS,
  type DeviceVisibilityTarget,
} from "@alliance/common/forms/device";
import {
  USER_VALUE_PROPERTIES,
  USER_VALUE_PROPERTY_LABELS,
} from "@alliance/common/forms/user-properties";
import type { Condition } from "@alliance/common/forms/visible-if-formula";
import DateTimePicker, { timeZoneLabel } from "../../../ui/DateTimePicker";
import { Input } from "../../../ui/Input";
import { Select } from "../../../ui/Select";
import { CheckboxField, Field, FieldGroup } from "../../../ui/templates/Form";

type ConditionOf<K extends Condition["kind"]> = Extract<Condition, { kind: K }>;

type RuleProps<K extends Condition["kind"]> = {
  condition: ConditionOf<K>;
  onChange: (condition: ConditionOf<K>) => void;
};

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
    <Field label={label}>
      {(control) => (
        <Select
          {...control}
          value={String(value)}
          onChange={(event) => onChange(event.target.value === "true")}
        >
          <option value="true">is set</option>
          <option value="false">is not set</option>
        </Select>
      )}
    </Field>
  );
}

export function DeviceRule({ condition, onChange }: RuleProps<"deviceType">) {
  const selected = new Set(condition.deviceType);
  return (
    <FieldGroup
      label="Devices"
      error={selected.size === 0 ? "Tick at least one device" : null}
    >
      {DEVICE_VISIBILITY_TARGETS.map((target) => (
        <CheckboxField
          key={target}
          label={DEVICE_LABELS[target]}
          checked={selected.has(target)}
          onChange={(event) => {
            const next = new Set(selected);
            if (event.target.checked) next.add(target);
            else next.delete(target);
            onChange({
              ...condition,
              deviceType: DEVICE_VISIBILITY_TARGETS.filter((t) => next.has(t)),
            });
          }}
        />
      ))}
    </FieldGroup>
  );
}

export function UserHasCityRule({
  condition,
  onChange,
}: RuleProps<"userHasCity">) {
  return (
    <SetSelect
      label="City"
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
    <>
      <Field label="Property">
        {(control) => (
          <Select
            {...control}
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
          </Select>
        )}
      </Field>
      <SetSelect
        label="State"
        value={condition.hasValue}
        onChange={(hasValue) => onChange({ ...condition, hasValue })}
      />
    </>
  );
}

const localZone = () =>
  timeZoneLabel(Intl.DateTimeFormat().resolvedOptions().timeZone);

export function FirstContractSignedRule({
  condition,
  onChange,
}: RuleProps<"firstContractSigned">) {
  return (
    <>
      <Field label="Signed">
        {(control) => (
          <Select
            {...control}
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
          </Select>
        )}
      </Field>
      <Field
        label={`Date (${localZone()})`}
        help="Members who have never signed a contract match neither."
      >
        {(control) => (
          <DateTimePicker
            {...control}
            value={condition.date}
            onChange={({ utcValue }) => {
              if (utcValue !== null) onChange({ ...condition, date: utcValue });
            }}
          />
        )}
      </Field>
    </>
  );
}

export function CompletedActionsRule({
  condition,
  onChange,
}: RuleProps<"completedActionCount">) {
  return (
    <Field label="Completed tasks, at least">
      {(control) => (
        <Input
          {...control}
          type="number"
          min={0}
          step={1}
          className="w-24"
          value={condition.atLeast}
          onChange={(event) => {
            const parsed = Number.parseInt(event.target.value, 10);
            if (Number.isNaN(parsed) || parsed < 0) return;
            onChange({ ...condition, atLeast: parsed });
          }}
        />
      )}
    </Field>
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
    <>
      <Field
        label="Block"
        error={
          isMissing
            ? "That block was deleted. Pick another block or remove this rule"
            : null
        }
      >
        {(control) => (
          <Select
            {...control}
            value={referencedId}
            onChange={(event) =>
              onChange({ ...condition, outputBlockVisible: event.target.value })
            }
          >
            {isMissing && (
              <option value={referencedId}>
                Missing block ({referencedId})
              </option>
            )}
            {outputBlocks.map((b) => (
              <option key={b.id} value={b.id} disabled={b.id === selfId}>
                ({b.id}) {b.label}
                {b.id === selfId ? " (this block)" : ""}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Visibility">
        {(control) => (
          <Select
            {...control}
            value={String(condition.isVisible ?? true)}
            onChange={(event) =>
              onChange({
                ...condition,
                isVisible: event.target.value === "true",
              })
            }
          >
            <option value="true">is visible in this output view</option>
            <option value="false">is hidden in this output view</option>
          </Select>
        )}
      </Field>
    </>
  );
}
