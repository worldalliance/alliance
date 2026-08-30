import { cn } from "@alliance/shared/styles/util";
import { useEffect } from "react";
import { AccessibilityInfo, Platform } from "react-native";
import Text from "./Text";

export default function CharacterLimitNotice({
  value,
  max,
  readOnly = false,
}: {
  value: string;
  max: number;
  readOnly?: boolean;
}) {
  const atLimit = !readOnly && value.length >= max;

  // accessibilityLiveRegion is Android-only; iOS gets the announcement here.
  useEffect(() => {
    if (atLimit && Platform.OS === "ios") {
      AccessibilityInfo.announceForAccessibility(
        `${max} character limit reached`,
      );
    }
  }, [atLimit, max]);

  return (
    <Text
      className={cn(
        "text-xs mt-1",
        atLimit ? "text-amber-600" : "text-zinc-500",
      )}
      accessibilityLiveRegion="polite"
    >
      {atLimit ? `${max} character limit reached` : `Maximum ${max} characters`}
    </Text>
  );
}
