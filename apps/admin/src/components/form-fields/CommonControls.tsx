import { cn } from "@alliance/shared/styles/util";

type RequiredToggleProps = {
  checked: boolean | undefined;
  onChange: (checked: boolean) => void;
  className?: string;
  label?: string;
};

export function RequiredToggle({
  checked,
  onChange,
  className = "",
  label = "Required",
}: RequiredToggleProps) {
  return (
    <label className={cn("flex items-center text-xs text-gray-700", className)}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mr-2"
      />
      {label}
    </label>
  );
}

type RequiredAsteriskProps = {
  required?: boolean;
  className?: string;
};

export function RequiredAsterisk({
  required,
  className = "text-red-500 ml-1",
}: RequiredAsteriskProps) {
  if (!required) return null;
  return <span className={className}>*</span>;
}

/** Option values that appear more than once in the list (schema rejects these on save). */
export function duplicateOptionValues(
  options: readonly { value: string }[],
): Set<string> {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const { value } of options) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return duplicates;
}

type DuplicateOptionsWarningProps = {
  duplicates: Set<string>;
};

export function DuplicateOptionsWarning({
  duplicates,
}: DuplicateOptionsWarningProps) {
  if (duplicates.size === 0) return null;
  return (
    <p className="mt-1 text-[11px] text-red-500">
      Duplicate option values ({Array.from(duplicates).join(", ")}): each option
      needs a unique value or the form won&apos;t save.
    </p>
  );
}

type OutputFieldToggleProps = {
  checked?: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
};

export function OutputFieldToggle({
  checked,
  onChange,
  className = "",
}: OutputFieldToggleProps) {
  return (
    <label className={cn("flex items-center text-xs text-gray-700", className)}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mr-2"
      />
      Set as output field
    </label>
  );
}

type OutputPrivateByDefaultToggleProps = {
  checked?: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
};

export function OutputPrivateByDefaultToggle({
  checked,
  onChange,
  className = "",
}: OutputPrivateByDefaultToggleProps) {
  return (
    <label className={cn("flex items-center text-xs text-gray-700", className)}>
      <input
        type="checkbox"
        checked={!!checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mr-2"
      />
      Private by default
    </label>
  );
}

export function AutoExtractUserDataToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center text-xs text-gray-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mr-1"
      />
      Automatically extract into user data
    </label>
  );
}
