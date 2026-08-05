import { cn } from "@alliance/shared/styles/util";
import { TouchableOpacity, View } from "react-native";
import FormModal from "./forms/FormModal";
import Text, { FontWeight } from "./system/Text";

export type BottomSheetOption<V extends string | number> = {
  value: V;
  label: string;
};

export function BottomSheetOptionRow({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="py-3 flex-row items-center"
    >
      <View
        className={cn(
          "w-5 h-5 rounded-full border mr-3 items-center justify-center",
          active ? "border-green" : "border-zinc-300",
        )}
      >
        {active && <View className="w-2.5 h-2.5 rounded-full bg-green" />}
      </View>
      <Text className="text-base text-zinc-800">{label}</Text>
    </TouchableOpacity>
  );
}

interface BottomSheetOptionPickerProps<V extends string | number> {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: BottomSheetOption<V>[];
  value: V | null | undefined;
  onSelect: (value: V) => void;
}

export default function BottomSheetOptionPicker<V extends string | number>({
  visible,
  onClose,
  title,
  options,
  value,
  onSelect,
}: BottomSheetOptionPickerProps<V>) {
  return (
    <FormModal visible={visible} onClose={onClose}>
      <Text className="text-lg text-zinc-900 mb-2" weight={FontWeight.Semibold}>
        {title}
      </Text>
      {options.map((option) => (
        <BottomSheetOptionRow
          key={String(option.value)}
          label={option.label}
          active={value === option.value}
          onPress={() => {
            onSelect(option.value);
            onClose();
          }}
        />
      ))}
    </FormModal>
  );
}
