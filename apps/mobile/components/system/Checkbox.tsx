import { cn } from "@alliance/shared/styles/util";
import { Check } from "lucide-react-native";
import { TouchableOpacity, View } from "react-native";
import InlineLabelMarkdownWrapper from "../InlineLabelMarkdownWrapper";

export enum CheckboxSize {
  Small = "sm",
  Medium = "md",
}

// `mt-0.5` centers the smaller box on the label's first line; `md` is tall
// enough not to need it.
const boxClasses: Record<CheckboxSize, string> = {
  [CheckboxSize.Small]: "w-5 h-5 mt-0.5 mr-3",
  [CheckboxSize.Medium]: "w-6 h-6 mr-2",
};

const iconSizes: Record<CheckboxSize, number> = {
  [CheckboxSize.Small]: 14,
  [CheckboxSize.Medium]: 16,
};

type CheckboxProps = {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  label?: string | null;
  error?: boolean;
  size?: CheckboxSize;
  className?: string;
};

export default function Checkbox({
  checked,
  onChange,
  disabled,
  label,
  error,
  size = CheckboxSize.Medium,
  className,
}: CheckboxProps) {
  const borderClass = checked
    ? "border-green"
    : error
      ? "border-red-500"
      : "border-zinc-400";

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      disabled={disabled}
      onPress={() => onChange?.(!checked)}
      className={cn("flex-row items-start", className)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
    >
      <View
        className={cn(
          "rounded border items-center justify-center",
          boxClasses[size],
          borderClass,
          disabled && "opacity-60",
          checked ? "bg-green" : "bg-white",
        )}
      >
        {checked && (
          <Check size={iconSizes[size]} color="#fff" strokeWidth={3} />
        )}
      </View>
      {label ? (
        <View className="flex-1">
          <InlineLabelMarkdownWrapper>{label}</InlineLabelMarkdownWrapper>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
