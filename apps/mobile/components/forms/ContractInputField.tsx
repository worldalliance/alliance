import type { ContractField } from "@alliance/common/forms/form-schema";
import { cn } from "@alliance/shared/styles/util";
import { TouchableOpacity, View } from "react-native";
import AppMarkdownWrapper from "../AppMarkdownWrapper";
import Card, { CardStyle } from "../system/Card";
import Text, { FontWeight } from "../system/Text";
import { type FieldInputProps, renderValidationMessage } from "./fieldParts";
import { OptionalLabelPrefix } from "./OptionalLabelPrefix";

export function ContractInputField({
  field,
  value,
  onChange,
  disabled,
  errorMessage,
  isOutputView,
  required,
}: FieldInputProps<ContractField>) {
  const contract = field.contract;
  const signedValue = typeof value === "boolean" ? value : undefined;
  return (
    <View className="gap-3">
      {contract?.markdown ? (
        <>
          <View className="rounded-lg border border-zinc-200 bg-white p-4">
            <AppMarkdownWrapper>{contract.markdown}</AppMarkdownWrapper>
          </View>
          <Card cardStyle={CardStyle.White} className="p-4">
            {!required && !isOutputView && <OptionalLabelPrefix />}
            <Text className="text-zinc-900 mb-3" weight={FontWeight.Medium}>
              {field.signQuestion.trim()}
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => onChange?.(true)}
                disabled={disabled}
                className={cn(
                  "flex-1 py-3 rounded-lg border items-center",
                  signedValue === true
                    ? "border-green-600 bg-green-50"
                    : "border-zinc-200 bg-white",
                )}
              >
                <Text
                  className={cn(
                    "",
                    signedValue === true ? "text-green-700" : "text-zinc-700",
                  )}
                  weight={FontWeight.Medium}
                >
                  {field.yesLabel.trim()}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onChange?.(false)}
                disabled={disabled}
                className={cn(
                  "flex-1 py-3 rounded-lg border items-center",
                  signedValue === false
                    ? "border-red-600 bg-red-50"
                    : "border-zinc-200 bg-white",
                )}
              >
                <Text
                  className={cn(
                    "",
                    signedValue === false ? "text-red-700" : "text-zinc-700",
                  )}
                  weight={FontWeight.Medium}
                >
                  {field.noLabel.trim()}
                </Text>
              </TouchableOpacity>
            </View>
          </Card>
        </>
      ) : (
        <View className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <Text className="text-sm text-zinc-500 italic">
            Select a contract in the form builder to preview.
          </Text>
        </View>
      )}
      {renderValidationMessage(errorMessage)}
    </View>
  );
}
