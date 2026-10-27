import type { ActionDto } from "@alliance/shared/client";
import { tracksCustomStat } from "@alliance/shared/lib/customActionStat";

export default function ActionCustomStat({
  action,
}: {
  action: Pick<
    ActionDto,
    "customStatType" | "customStatLabel" | "customStatValue"
  >;
}) {
  if (
    !tracksCustomStat(action.customStatType) ||
    action.customStatValue == null
  ) {
    return null;
  }
  return (
    <div className="mt-3">
      <p className="text-zinc-800">{action.customStatLabel}:</p>
      <p className="text-xl font-bold">{action.customStatValue}</p>
    </div>
  );
}
