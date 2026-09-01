import { cn } from "@alliance/shared/styles/util";
import { type ReactNode } from "react";
import { View } from "react-native";
import { useAnnounceOnIos } from "../../lib/useAnnounceOnIos";
import Text from "./Text";

interface InlineErrorProps {
  message?: string | null;
  className?: string;
  children?: ReactNode;
}

// The view stays mounted with no message in it, because Android announces a
// live region the message arrives under, not one that mounts already holding
// it. Empty it sits out of the flow, so a parent's gap keeps no row for it.
export default function InlineError({
  message,
  className,
  children,
}: InlineErrorProps) {
  useAnnounceOnIos(message);

  return (
    <View
      className={cn(
        "flex-row items-center gap-x-2",
        message ? className : "absolute",
      )}
      accessibilityLiveRegion="polite"
    >
      {message ? (
        <>
          <Text className="flex-1 text-sm text-red-500">{message}</Text>
          {children}
        </>
      ) : null}
    </View>
  );
}
