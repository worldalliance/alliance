import { type AnyField } from "@alliance/common/forms/form-schema";
import { outputFieldPublicToggle } from "../lib/copy";

export function outputPublicToggle(
  field: AnyField,
  sharePublicly: boolean,
): {
  label: string;
  checked: boolean;
  sharePubliclyWhen: (checked: boolean) => boolean;
} | null {
  if (!field.output?.output) return null;
  const makePublic = !!field.output.privateByDefault;
  return {
    label: makePublic
      ? outputFieldPublicToggle.showPublicly
      : outputFieldPublicToggle.hidePublicly,
    checked: makePublic ? sharePublicly : !sharePublicly,
    sharePubliclyWhen: (checked) => (makePublic ? checked : !checked),
  };
}
