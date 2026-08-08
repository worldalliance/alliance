import { cn } from "@alliance/shared/styles/util";
import { Image, ImageSourcePropType, View, ViewProps } from "react-native";
import Text, { FontWeight } from "./Text";

export enum AvatarSize {
  ExtraSmall = "xs",
  Small = "sm",
  Medium = "md",
  Large = "lg",
  ExtraLarge = "xl",
}

interface AvatarProps extends ViewProps {
  source?: ImageSourcePropType;
  initials?: string;
  size?: AvatarSize;
  backgroundColor?: string;
}

const sizeClasses: Record<AvatarSize, { container: string; text: string }> = {
  [AvatarSize.ExtraSmall]: { container: "w-6 h-6", text: "text-xs" },
  [AvatarSize.Small]: { container: "w-8 h-8", text: "text-xs" },
  [AvatarSize.Medium]: { container: "w-10 h-10", text: "text-sm" },
  [AvatarSize.Large]: { container: "w-12 h-12", text: "text-base" },
  [AvatarSize.ExtraLarge]: { container: "w-14 h-14", text: "text-lg" },
};

export default function Avatar({
  source,
  initials,
  size = AvatarSize.Medium,
  backgroundColor,
  className,
  style,
  ...props
}: AvatarProps) {
  const sizeStyle = sizeClasses[size];
  const containerClasses = cn(
    "justify-center items-center rounded-full bg-zinc-200",
    sizeStyle.container,
    className,
  );
  const imageClasses = cn("rounded-full", sizeStyle.container);
  const textClasses = cn("text-zinc-700 text-center", sizeStyle.text);

  const combinedStyle = backgroundColor
    ? [{ backgroundColor }, style].filter(Boolean)
    : style;

  if (source) {
    return (
      <View className={containerClasses} style={combinedStyle} {...props}>
        <Image source={source} className={imageClasses} />
      </View>
    );
  }

  return (
    <View className={containerClasses} style={combinedStyle} {...props}>
      <Text className={textClasses} weight={FontWeight.Semibold}>
        {initials}
      </Text>
    </View>
  );
}
