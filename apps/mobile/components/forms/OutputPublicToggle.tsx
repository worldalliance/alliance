import { type AnyField } from "@alliance/common/forms/form-schema";
import { outputFieldPublicToggle } from "@alliance/shared/lib/copy";
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
  if (!field.output?.output) return null;
  const useMakePublicToggle = !!field.output.privateByDefault;
  const toggleChecked = useMakePublicToggle ? sharePublicly : !sharePublicly;
  const toggleLabel = useMakePublicToggle
    ? outputFieldPublicToggle.showPublicly
    : outputFieldPublicToggle.hidePublicly;
  return (
    <View className="mt-2">
      <Checkbox
        checked={toggleChecked}
        disabled={disabled}
        onChange={(next) => onChange(useMakePublicToggle ? next : !next)}
        label={toggleLabel}
      />
    </View>
  );
}
