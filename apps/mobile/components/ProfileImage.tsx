import { cn } from "@alliance/shared/styles/util";
import { User } from "lucide-react-native";
import { Image, View } from "react-native";
import { getApiUrl, getImageSource } from "../lib/config";
import { colors } from "../lib/style/colors";

type ProfileImageSize =
  | "mini"
  | "small"
  | "medium"
  | "large"
  | "larger"
  | "huge";

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

//TODO
const isLocalhostHost = (hostname: string) =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "0.0.0.0" ||
  hostname === "::1";

export const resolveProfileImageUri = (pfp: string) => {
  if (pfp.startsWith("data:") || pfp.startsWith("file:")) {
    return pfp;
  }

  if (!pfp.startsWith("http")) {
    return getImageSource(pfp);
  }

  if (!__DEV__) {
    return pfp;
  }

  try {
    const parsed = new URL(pfp);
    if (!isLocalhostHost(parsed.hostname)) {
      return pfp;
    }

    const match = parsed.pathname.match(/\/images\/(.+)/);
    if (match?.[1]) {
      return getImageSource(match[1]);
    }

    return `${getApiUrl()}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return pfp;
  }
};

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

  if (pfp && resolveProfileImageUri(pfp)) {
    return (
      <Image
        source={{ uri: resolveProfileImageUri(pfp) }}
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
