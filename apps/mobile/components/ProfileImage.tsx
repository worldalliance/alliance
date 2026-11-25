import { cn } from "@alliance/shared/styles/util";
import { User } from "lucide-react-native";
import { useState } from "react";
import { Image, View } from "react-native";
import { profileImageUri, type ProfileImageSize } from "../lib/profileImageUri";
import { colors } from "../lib/style/colors";

const sizeMap: Record<ProfileImageSize, number> = {
  mini: 16,
  small: 24,
  medium: 32,
  large: 36,
  larger: 48,
  huge: 116,
};

const radiusMap: Record<ProfileImageSize, number> = {
  mini: 2,
  small: 3,
  medium: 4,
  large: 4,
  larger: 6,
  huge: 8,
};

const iconSizeMap: Record<ProfileImageSize, number> = {
  mini: 10,
  small: 14,
  medium: 18,
  large: 20,
  larger: 30,
  huge: 48,
};

interface ProfileImageProps {
  pfp: string | null;
  size?: ProfileImageSize;
  className?: string;
}

export default function ProfileImage({
  pfp,
  size = "large",
  className,
}: ProfileImageProps) {
  const dimension = sizeMap[size];
  const radius = radiusMap[size];
  const baseStyle = {
    width: dimension,
    height: dimension,
    borderRadius: radius,
  };

  const uri = pfp ? profileImageUri(pfp, size) : null;
  const [failedUri, setFailedUri] = useState<string | null>(null);

  if (uri && uri !== failedUri) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailedUri(uri)}
        resizeMode="cover"
        style={baseStyle}
        className={cn("bg-white shrink-0", className)}
      />
    );
  }
  return (
    <View
      style={baseStyle}
      className={cn(
        "bg-white border border-zinc-200 items-center justify-center shrink-0",
        className,
      )}
    >
      <User size={iconSizeMap[size]} color={colors.text.tertiary} />
    </View>
  );
}
