import { FlowButtonKind } from "@alliance/shared/forms/flowStyle";
import { cn } from "@alliance/shared/styles/util";
import { type LucideIcon } from "lucide-react-native";
import { type ReactNode } from "react";
import {
  ActivityIndicator,
  TouchableOpacity,
  View,
  type TouchableOpacityProps,
} from "react-native";
import { colors } from "../../lib/style/colors";
import Text, { FontWeight } from "../system/Text";

const KINDS: Record<
  FlowButtonKind,
  {
    className: string;
    textClassName: string;
    contentColor: string;
  }
> = {
  [FlowButtonKind.Primary]: {
    className: "h-11 rounded-md bg-green px-4",
    textClassName: "text-white",
    contentColor: colors.white,
  },
  [FlowButtonKind.Secondary]: {
    className: "h-11 rounded-md bg-zinc-200 px-4",
    textClassName: "text-black",
    contentColor: "#000",
  },
  [FlowButtonKind.Inverse]: {
    className: "h-11 rounded-md bg-white px-4",
    textClassName: "text-zinc-900",
    contentColor: "#18181b",
  },
  [FlowButtonKind.InverseSecondary]: {
    className: "h-11 rounded-md bg-navy px-4",
    textClassName: "text-white",
    contentColor: colors.white,
  },
  [FlowButtonKind.Icon]: {
    className: "h-9 w-9 rounded-full bg-zinc-100",
    textClassName: "",
    contentColor: colors.text.icon,
  },
};

/** Every control in the task flow: borderless, with one radius and weight. */
export default function FlowButton({
  kind,
  title,
  iconLeft: IconLeft,
  iconRight: IconRight,
  loading = false,
  disabled = false,
  className,
  children,
  ...props
}: Omit<TouchableOpacityProps, "children"> & {
  kind: FlowButtonKind;
  title?: string;
  iconLeft?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
  children?: ReactNode;
}) {
  const { className: kindClassName, textClassName, contentColor } = KINDS[kind];
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      activeOpacity={0.8}
      disabled={disabled || loading}
      className={cn(
        "flex-row items-center justify-center",
        kindClassName,
        disabled && "opacity-50",
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={contentColor} />
      ) : title ? (
        <View className="flex-row items-center gap-x-2">
          {IconLeft ? <IconLeft size={18} color={contentColor} /> : null}
          <Text className={textClassName} weight={FontWeight.Medium}>
            {title}
          </Text>
          {IconRight ? <IconRight size={18} color={contentColor} /> : null}
        </View>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}
