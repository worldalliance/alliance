import {
  canSubmitWithdrawal,
  WITHDRAWAL_OPTION_LABELS,
  WITHDRAWAL_OPTIONS,
  withdrawalFlagsFromOption,
  type WithdrawalOption,
} from "@alliance/common/actionActivity";
import { type ActionWithdrawal } from "@alliance/shared/lib/actionTaskPanel";
import { cn } from "@alliance/shared/styles/util";
import { router } from "expo-router";
import { Fragment, useState } from "react";
import { TextInput, TouchableOpacity, View } from "react-native";
import Button, { ButtonColor, ButtonSize } from "../system/Button";
import Text, { FontWeight } from "../system/Text";
import FormModal from "./FormModal";

export default function WithdrawalModal({
  visible,
  onClose,
  disabled,
  onWithdraw,
}: {
  visible: boolean;
  onClose: () => void;
  disabled: boolean;
  onWithdraw: (choice: Omit<ActionWithdrawal, "partialFormData">) => void;
}) {
  const [withdrawalOption, setWithdrawalOption] =
    useState<WithdrawalOption | null>(null);
  const [customReason, setCustomReason] = useState("");

  return (
    <FormModal visible={visible} onClose={onClose}>
      <Text className="text-lg text-zinc-900 mb-3" weight={FontWeight.Semibold}>
        Withdraw from action
      </Text>
      <View className="gap-2 mb-3">
        {WITHDRAWAL_OPTIONS.map((option) => (
          <Fragment key={option}>
            <TouchableOpacity
              activeOpacity={0.8}
              className={cn(
                "border rounded px-3 py-3",
                withdrawalOption === option
                  ? "border-blue-600 bg-blue-100"
                  : "border-zinc-200",
              )}
              onPress={() => {
                setWithdrawalOption((previous) =>
                  previous === option ? null : option,
                );
              }}
            >
              <Text className="text-base text-zinc-900">
                {WITHDRAWAL_OPTION_LABELS[option]}
              </Text>
            </TouchableOpacity>
            {option === "moral" && (
              <TouchableOpacity
                activeOpacity={0.8}
                className="border border-zinc-200 rounded px-3 py-3"
                onPress={() => {
                  onClose();
                  router.push("/membership");
                }}
              >
                <Text className="text-base text-zinc-900">On vacation</Text>
              </TouchableOpacity>
            )}
          </Fragment>
        ))}
      </View>
      {withdrawalOption !== null && (
        <TextInput
          value={customReason}
          onChangeText={setCustomReason}
          placeholder="Explain in more detail..."
          placeholderTextColor="#9ca3af"
          multiline
          textAlignVertical="top"
          className="border border-zinc-200 rounded px-3 py-2 h-24 text-base text-zinc-900 mb-3"
        />
      )}
      <View className="w-full self-center">
        <Button
          onPress={() => {
            if (withdrawalOption === null) return;
            onWithdraw({
              ...withdrawalFlagsFromOption(withdrawalOption),
              reason: customReason.trim(),
            });
          }}
          color={ButtonColor.Black}
          size={ButtonSize.Large}
          disabled={
            disabled || !canSubmitWithdrawal(withdrawalOption, customReason)
          }
          title="Withdraw"
        />
      </View>
    </FormModal>
  );
}
