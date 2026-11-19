import {
  CATEGORIES,
  RISK_GROUP_NAMES,
  type RiskGroup,
} from "@alliance/kora-review/categories";
import { cn } from "@alliance/shared/styles/util";
import { TriangleAlert } from "lucide-react";
import { ONBOARDING_COPY } from "./copy";

const GROUPS: { group: RiskGroup; risks: typeof CATEGORIES }[] = Object.keys(
  RISK_GROUP_NAMES,
).map((group) => ({
  group: group as RiskGroup,
  risks: CATEGORIES.filter((risk) => risk.group === group),
}));

/** Opt-outs are stored as the risks left out, while the screen ticks the ones shown. */
export function KoraRiskOptOut({
  optOutRisks,
  onChange,
}: {
  optOutRisks: string[];
  onChange: (optOutRisks: string[]) => void;
}) {
  const shown = (id: string) => !optOutRisks.includes(id);
  const toggle = (id: string) =>
    onChange(
      shown(id) ? [...optOutRisks, id] : optOutRisks.filter((r) => r !== id),
    );
  const ticked = CATEGORIES.length - optOutRisks.length;

  return (
    <div className="flex flex-col gap-6">
      <p aria-live="polite" className="text-sm text-zinc-600">
        {ONBOARDING_COPY.risksLeft(ticked)}
      </p>
      {ticked < 3 && (
        <p
          role="status"
          className="rounded border border-amber-300 bg-amber-50 p-4 text-sm"
        >
          {ONBOARDING_COPY.risksWarning}
        </p>
      )}
      {GROUPS.map(({ group, risks }) => (
        <fieldset key={group} className="flex flex-col gap-2">
          <legend className="pb-2 font-medium">
            {RISK_GROUP_NAMES[group]}
          </legend>
          <div className="flex flex-col gap-2">
            {risks.map((risk) => (
              <label
                key={risk.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded border px-4 py-3",
                  shown(risk.id)
                    ? "border-[var(--site-primary)] bg-zinc-50"
                    : "border-zinc-300 bg-white text-zinc-600",
                )}
              >
                <input
                  type="checkbox"
                  checked={shown(risk.id)}
                  onChange={() => toggle(risk.id)}
                />
                <span className="flex-1">{risk.label}</span>
                {risk.sensitive && (
                  <span className="flex items-center gap-1 text-sm text-amber-700">
                    <TriangleAlert aria-hidden size={16} />
                    {ONBOARDING_COPY.hardRisk}
                  </span>
                )}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
