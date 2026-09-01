import { cn } from "@alliance/shared/styles/util";
import { useAnnounceOnIos } from "../../lib/useAnnounceOnIos";
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
  const limitReached = `${max} character limit reached`;

  useAnnounceOnIos(atLimit ? limitReached : null);

  return (
    <Text
      className={cn(
        "text-xs mt-1",
        atLimit ? "text-amber-600" : "text-zinc-500",
      )}
      accessibilityLiveRegion="polite"
    >
      {atLimit ? limitReached : `Maximum ${max} characters`}
    </Text>
  );
}
