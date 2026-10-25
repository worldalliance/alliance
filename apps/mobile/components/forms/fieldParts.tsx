import type { AnyField, FormValue } from "@alliance/common/forms/form-schema";
import { type FormValueUpdater } from "@alliance/shared/forms/formValueUpdater";
import { View } from "react-native";
import InlineLabelMarkdownWrapper from "../InlineLabelMarkdownWrapper";
import Text from "../system/Text";
import { OptionalLabelPrefix } from "./OptionalLabelPrefix";

export const sharedInputClasses =
  "w-full rounded-lg border bg-white px-3 py-3 text-base text-zinc-900";

export const inputClasses = ({
  hasError,
  disabled,
}: {
  hasError: boolean;
  disabled?: boolean;
}) =>
  `${sharedInputClasses} ${
    hasError ? "border-red-500" : "border-zinc-200"
  } ${disabled ? "opacity-60" : ""}`;

export type FieldInputProps<F extends AnyField> = {
  field: F;
  value: FormValue | undefined;
  onChange?: (value: FormValueUpdater) => void;
  onFocus?: () => void;
  disabled?: boolean;
  /** Null, or a non-blank message. */
  errorMessage: string | null;
  isOutputView?: boolean;
  hideLabel?: boolean;
  required: boolean;
};

export const renderValidationMessage = (message: string | null) =>
  message ? (
    <Text className="text-base text-red-500 mt-1">{message}</Text>
  ) : null;

export function RenderLabel({
  field,
  isOutputView,
  hideLabel,
  required,
}: {
  field: AnyField;
  isOutputView?: boolean;
  hideLabel?: boolean;
  /** Effective requiredness; defaults to the field's static `required` flag. */
  required?: boolean;
}) {
  if (hideLabel) return null;
  const isRequired = required ?? !!field.required;
  if (field.label === null && isRequired) return null;
  return (
    <View className="mb-1">
      {!isRequired && !isOutputView && <OptionalLabelPrefix />}
      {field.label !== null && (
        <View>
          <InlineLabelMarkdownWrapper>{field.label}</InlineLabelMarkdownWrapper>
        </View>
      )}
    </View>
  );
}
