import { FlowButtonKind } from "@alliance/shared/forms/flowStyle";
import { cn } from "@alliance/shared/styles/util";
import { type ReactNode } from "react";
import {
  ActivityIndicator,
  TouchableOpacity,
  type TouchableOpacityProps,
} from "react-native";
import { colors } from "../../lib/style/colors";
import Text, { FontWeight } from "../system/Text";

const KINDS: Record<
  FlowButtonKind,
  { className: string; textClassName: string; spinnerColor: string }
> = {
  [FlowButtonKind.Primary]: {
    className: "h-11 rounded-md bg-green px-4",
    textClassName: "text-white",
    spinnerColor: colors.white,
  },
  [FlowButtonKind.Secondary]: {
    className: "h-11 rounded-md bg-zinc-200 px-4",
    textClassName: "text-black",
    spinnerColor: colors.text.icon,
  },
  [FlowButtonKind.Inverse]: {
    className: "h-11 rounded-md bg-white px-4",
    textClassName: "text-zinc-900",
    spinnerColor: colors.text.icon,
  },
  [FlowButtonKind.Icon]: {
    className: "h-9 w-9 rounded-full bg-zinc-100",
    textClassName: "",
    spinnerColor: colors.text.icon,
  },
};

/** Every control in the task flow: borderless, with one radius and weight. */
export default function FlowButton({
  kind,
  title,
  loading = false,
  disabled = false,
  className,
  children,
  ...props
}: Omit<TouchableOpacityProps, "children"> & {
  kind: FlowButtonKind;
  title?: string;
  loading?: boolean;
  children?: ReactNode;
}) {
  const { className: kindClassName, textClassName, spinnerColor } = KINDS[kind];
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
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : title ? (
        <Text className={textClassName} weight={FontWeight.Medium}>
          {title}
        </Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}
