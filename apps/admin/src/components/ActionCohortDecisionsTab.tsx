import { errorMessage } from "@alliance/common/errorMessage";
import {
  cohortDecisionsListForActionAdmin,
  type CohortDecisionDto,
  type CohortDecisionReason,
} from "@alliance/shared/client";
import { formatDateTime } from "@alliance/shared/lib/dateFormatters";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import InlineError from "@alliance/sharedweb/ui/InlineError";
import Spinner from "@alliance/sharedweb/ui/Spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@alliance/sharedweb/ui/Tooltip";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { CohortDecisionCorrectionModal } from "./CohortDecisionCorrectionModal";

const REASON_LABELS: Record<CohortDecisionReason, string> = {
  launch: "At launch",
  signing: "On signing",
  resolved_after_deadline: "Resolved after deadline",
  backfill: "Backfill",
  staff_correction: "Staff correction",
  prerequisites_resolved: "After prerequisites",
};

const formatTime = (iso: string) => formatDateTime(new Date(iso));

const decisionLabel = (included: boolean) =>
  included ? "Assigned" : "Excluded";

export default function ActionCohortDecisionsTab({
  actionId,
}: {
  actionId: number;
}) {
  const [search, setSearch] = useState("");
  const [correcting, setCorrecting] = useState<CohortDecisionDto | null>(null);

  const decisions = useQuery({
    queryKey: queryKeys.actionCohortDecisionsAdmin(actionId),
    queryFn: () =>
      cohortDecisionsListForActionAdmin({
        path: { actionId },
        throwOnError: true,
      }).then((res) => res.data),
  });

  if (decisions.isPending) return <Spinner />;
  if (decisions.isError) {
    return (
      <InlineError
        message={errorMessage({
          error: decisions.error,
          fallback: "Could not load cohort decisions",
        })}
      />
    );
  }

  const rows = decisions.data;
  const assignedCount = rows.filter((row) => row.included).length;
  const query = search.trim().toLowerCase();
  const visible = query
    ? rows.filter((row) => row.userName.toLowerCase().includes(query))
    : rows;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-600">
          {assignedCount} assigned, {rows.length - assignedCount} excluded.
          Members without a decision are not listed.
        </p>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members"
          aria-label="Search members"
          className="rounded border border-gray-2 px-3 py-1.5 text-sm"
        />
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500">
          <tr>
            <th className="py-2">Member</th>
            <th>Decision</th>
            <th>Reason</th>
            <th>Resolved</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr
              key={row.userId}
              className="border-t border-gray-2 align-top [&>td]:py-2"
            >
              <td>
                <Link to={`/member/${row.userId}`} className="hover:underline">
                  {row.userName}
                </Link>
                {row.corrections.map((correction) => (
                  <p
                    key={correction.correctedAt}
                    className="mt-1 text-xs text-zinc-500"
                  >
                    Was {decisionLabel(correction.previousIncluded)} (
                    {REASON_LABELS[correction.previousReason]},{" "}
                    {formatTime(correction.previousResolvedAt)}).{" "}
                    {correction.correctedByName ?? "Deleted user"},{" "}
                    {formatTime(correction.correctedAt)}: {correction.note}
                  </p>
                ))}
              </td>
              <td>{decisionLabel(row.included)}</td>
              <td>{REASON_LABELS[row.reason]}</td>
              <td>{formatTime(row.resolvedAt)}</td>
              <td className="text-right">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        aria-label={`Correct ${row.userName}'s decision`}
                        onClick={() => setCorrecting(row)}
                        className="rounded p-1.5 text-zinc-600 hover:bg-zinc-100"
                      />
                    }
                  >
                    <ArrowLeftRight size={16} />
                  </TooltipTrigger>
                  <TooltipContent>Correct decision</TooltipContent>
                </Tooltip>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {correcting && (
        <CohortDecisionCorrectionModal
          actionId={actionId}
          decision={correcting}
          onClose={() => setCorrecting(null)}
        />
      )}
    </div>
  );
}
