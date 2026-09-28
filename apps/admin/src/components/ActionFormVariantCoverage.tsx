import { withCount } from "@alliance/common/plural";
import type { ActionFormVariantStatsDto } from "@alliance/shared/client/types.gen";
import { CardStyle } from "@alliance/shared/styles/card";
import Card from "@alliance/sharedweb/ui/Card";
import { useNavigate } from "react-router";
import { formatPct } from "../lib/formatPct";

export interface ActionFormVariantCoverageProps {
  stats: ActionFormVariantStatsDto[];
  percentageSum: number;
  hasVariants: boolean;
}

export default function ActionFormVariantCoverage({
  stats,
  percentageSum,
  hasVariants,
}: ActionFormVariantCoverageProps) {
  const navigate = useNavigate();
  const totalAssigned = stats.reduce((sum, s) => sum + s.assigned, 0);
  const totalSubmitted = stats.reduce((sum, s) => sum + s.submitted, 0);

  return (
    <Card style={CardStyle.White} className="p-4">
      <div className="text-sm text-zinc-600 mb-3">
        Coverage:{" "}
        <span className="font-medium text-zinc-900">
          {totalAssigned} users assigned
        </span>{" "}
        across {withCount(stats.length, "group")}.{" "}
        {percentageSum > 100 ? (
          <span className="text-red-600">
            Percentage total {formatPct(percentageSum)} exceeds 100% — fix
            splits before publishing.
          </span>
        ) : !hasVariants ? (
          <span className="text-zinc-500">
            No variants — all users see the default form.
          </span>
        ) : (
          <span>
            Users are assigned the first time they load the action. Default form
            covers the remaining {formatPct(100 - percentageSum)}.
          </span>
        )}
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-zinc-500 border-b">
            <th className="py-2 pr-3">Group</th>
            <th className="py-2 pr-3">Form</th>
            <th className="py-2 pr-3">Split</th>
            <th className="py-2 pr-3 text-right">Assigned</th>
            <th className="py-2 pr-3 text-right">Submitted</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.variantId ?? "default"} className="border-b">
              <td className="py-2 pr-3 font-medium">
                {s.variantId === null ? (
                  <span className="text-zinc-500">Default ·</span>
                ) : null}{" "}
                {s.name}
              </td>
              <td className="py-2 pr-3">
                {s.formId != null ? (
                  <button
                    className="text-blue-600 hover:underline"
                    onClick={() => navigate(`/forms/${s.formId}`)}
                  >
                    Form #{s.formId}
                  </button>
                ) : (
                  <span className="text-zinc-400">—</span>
                )}
              </td>
              <td className="py-2 pr-3 text-zinc-700">
                {s.splitValue != null ? formatPct(s.splitValue) : "remainder"}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {s.assigned}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {s.submitted}
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={3} className="py-2 pr-3 text-right text-zinc-500">
              Total
            </td>
            <td className="py-2 pr-3 text-right tabular-nums font-medium">
              {totalAssigned}
            </td>
            <td className="py-2 pr-3 text-right tabular-nums font-medium">
              {totalSubmitted}
            </td>
          </tr>
        </tbody>
      </table>
    </Card>
  );
}
