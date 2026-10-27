import { type AnyField } from "@alliance/common/forms/form-schema";
import { outputPublicToggle } from "@alliance/shared/forms/outputPublicToggle";

export default function OutputPublicToggle({
  field,
  sharePublicly,
  disabled,
  onChange,
}: {
  field: AnyField;
  sharePublicly: boolean;
  disabled: boolean;
  onChange: (sharePublicly: boolean) => void;
}) {
  const toggle = outputPublicToggle(field, sharePublicly);
  if (!toggle) return null;
  return (
    <label className="mt-2 flex items-center text-sm text-gray-500">
      <input
        type="checkbox"
        className="mr-2 h-4 w-4"
        checked={toggle.checked}
        disabled={disabled}
        onChange={(event) =>
          onChange(toggle.sharePubliclyWhen(event.target.checked))
        }
      />
      {toggle.label}
    </label>
  );
}
