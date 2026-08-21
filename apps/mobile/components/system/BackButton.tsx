import { cn } from "@alliance/shared/styles/util";
import { Href, router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { colors } from "../../lib/style/colors";
import Button, { ButtonColor, ButtonSize } from "./Button";

interface BackButtonProps {
  onPress?: () => void;
  iconSize?: number;
  bordered?: boolean;
  className?: string;
  fallbackRoute?: Href;
}

export default function BackButton({
  onPress,
  iconSize = 25,
  bordered = false,
  className,
  fallbackRoute = "/profile",
}: BackButtonProps) {
  return (
    <Button
      color={ButtonColor.Transparent}
      onPress={
        onPress ??
        (() =>
          router.canGoBack() ? router.back() : router.push(fallbackRoute))
      }
      size={ButtonSize.Custom}
      className={cn(
        bordered ? "border border-zinc-200 rounded w-9 h-9" : "h-9",
        className,
      )}
    >
      <ChevronLeft size={iconSize} color={colors.text.secondary} />
    </Button>
  );
}
