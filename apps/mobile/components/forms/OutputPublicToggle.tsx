import { type AnyField } from "@alliance/common/forms/form-schema";
import { outputPublicToggle } from "@alliance/shared/forms/outputPublicToggle";
import { View } from "react-native";
import Checkbox from "../system/Checkbox";

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
    <View className="mt-2">
      <Checkbox
        checked={toggle.checked}
        disabled={disabled}
        onChange={(next) => onChange(toggle.sharePubliclyWhen(next))}
        label={toggle.label}
      />
    </View>
  );
}
