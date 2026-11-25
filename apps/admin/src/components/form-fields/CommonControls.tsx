import { Banner, BannerTone } from "../../ui/templates/Banner";
import { CheckboxField } from "../../ui/templates/Form";

type SettingCheckboxProps = {
  checked: boolean | undefined;
  onChange: (checked: boolean) => void;
  className?: string;
};

export function RequiredToggle({
  checked,
  onChange,
  className,
  label = "Required",
}: SettingCheckboxProps & { label?: string }) {
  return (
    <CheckboxField
      label={label}
      checked={!!checked}
      onChange={(event) => onChange(event.target.checked)}
      className={className}
    />
  );
}

export function RequiredAsterisk({
  required,
  className = "ml-1 text-danger",
}: {
  required?: boolean;
  className?: string;
}) {
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

export function DuplicateOptionsWarning({
  duplicates,
}: {
  duplicates: Set<string>;
}) {
  if (duplicates.size === 0) return null;
  return (
    <Banner inline tone={BannerTone.Warning}>
      Duplicate option values ({Array.from(duplicates).join(", ")}): each option
      needs a unique value or the form won&apos;t save.
    </Banner>
  );
}

export function OutputFieldToggle({
  checked,
  onChange,
  className,
}: Omit<SettingCheckboxProps, "checked"> & { checked?: boolean }) {
  return (
    <RequiredToggle
      label="Set as output field"
      checked={checked}
      onChange={onChange}
      className={className}
    />
  );
}

export function OutputPrivateByDefaultToggle({
  checked,
  onChange,
  className,
}: Omit<SettingCheckboxProps, "checked"> & { checked?: boolean }) {
  return (
    <RequiredToggle
      label="Private by default"
      checked={checked}
      onChange={onChange}
      className={className}
    />
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
    <RequiredToggle
      label="Automatically extract into user data"
      checked={checked}
      onChange={onChange}
    />
  );
}
