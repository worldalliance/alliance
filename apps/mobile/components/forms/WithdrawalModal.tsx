import {
  canSubmitWithdrawal,
  WITHDRAWAL_OPTION_LABELS,
  WITHDRAWAL_OPTIONS,
  withdrawalFlagsFromOption,
  type WithdrawalOption,
} from "@alliance/common/actionActivity";
import { type ActionWithdrawal } from "@alliance/shared/lib/actionTaskPanel";
import { withdrawalOptions } from "@alliance/shared/lib/copy";
import { cn } from "@alliance/shared/styles/util";
import { router } from "expo-router";
import {
  CircleDashed,
  Clock,
  Scale,
  TreePalm,
  type LucideIcon,
} from "lucide-react-native";
import { Fragment, useState } from "react";
import { TextInput, TouchableOpacity, View } from "react-native";
import { colors } from "../../lib/style/colors";
import Button, { ButtonColor, ButtonSize } from "../system/Button";
import Text, { FontWeight } from "../system/Text";
import FormModal from "./FormModal";

const WITHDRAWAL_OPTION_ICONS: Record<WithdrawalOption, LucideIcon> = {
  out_of_time: Clock,
  moral: Scale,
  other: CircleDashed,
};

function WithdrawalOptionRow({
  icon: Icon,
  label,
  selected,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cn(
        "flex-row items-center gap-x-2 border border-zinc-200 rounded px-4 py-3",
        selected && "bg-zinc-100",
      )}
      onPress={onPress}
    >
      <Icon size={16} color={colors.text.primary} />
      <Text className="text-base text-zinc-900" weight={FontWeight.Medium}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

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
      <Text className="text-base text-zinc-900 text-center mb-3">
        {withdrawalOptions}
      </Text>
      <View className="gap-2">
        {WITHDRAWAL_OPTIONS.map((option) => (
          <Fragment key={option}>
            <WithdrawalOptionRow
              icon={WITHDRAWAL_OPTION_ICONS[option]}
              label={WITHDRAWAL_OPTION_LABELS[option]}
              selected={withdrawalOption === option}
              onPress={() =>
                setWithdrawalOption((previous) =>
                  previous === option ? null : option,
                )
              }
            />
            {option === "moral" && (
              <WithdrawalOptionRow
                icon={TreePalm}
                label="On vacation"
                selected={false}
                onPress={() => {
                  onClose();
                  router.push("/membership");
                }}
              />
            )}
          </Fragment>
        ))}
      </View>
      {withdrawalOption !== null && (
        <View className="mt-3 gap-y-3">
          <TextInput
            value={customReason}
            onChangeText={setCustomReason}
            placeholder="Explain in more detail..."
            placeholderTextColor="#9ca3af"
            multiline
            textAlignVertical="top"
            className="border border-zinc-200 rounded px-3 py-2 h-24 text-base text-zinc-900"
          />
          <Button
            onPress={() =>
              onWithdraw({
                ...withdrawalFlagsFromOption(withdrawalOption),
                reason: customReason.trim(),
              })
            }
            color={ButtonColor.Black}
            size={ButtonSize.Large}
            disabled={
              disabled || !canSubmitWithdrawal(withdrawalOption, customReason)
            }
            title="Withdraw"
          />
        </View>
      )}
    </FormModal>
  );
}
