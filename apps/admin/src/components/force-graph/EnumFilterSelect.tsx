import { z } from "zod";

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
  <label className="flex items-center gap-1.5">
    <span className="text-xs font-medium text-gray-600">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(z.enum(values).parse(e.target.value))}
      className="rounded border border-gray-300 px-2 py-1 text-xs bg-white"
    >
      {Object.values(values).map((v) => (
        <option key={v} value={v}>
          {options[v].label}
        </option>
      ))}
    </select>
  </label>
);
