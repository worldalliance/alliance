import { z } from "zod";
import { Select } from "../../ui/Select";
import { Field } from "../../ui/templates/Form";

/** A labelled select over an enum's values, for a graph's inspector. */
export const EnumFilterSelect = <E extends string>({
  label,
  values,
  options,
  value,
  onChange,
}: {
  label: string;
  values: Record<string, E>;
  options: Record<E, { label: string }>;
  value: E;
  onChange: (value: E) => void;
}) => (
  <Field label={label}>
    {(control) => (
      <Select
        {...control}
        value={value}
        onChange={(e) => onChange(z.enum(values).parse(e.target.value))}
      >
        {Object.values(values).map((v) => (
          <option key={v} value={v}>
            {options[v].label}
          </option>
        ))}
      </Select>
    )}
  </Field>
);
