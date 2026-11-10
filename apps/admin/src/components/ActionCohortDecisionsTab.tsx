import { errorMessage } from "@alliance/common/errorMessage";
import {
  type CohortDecisionDto,
  type CohortDecisionReason,
} from "@alliance/shared/client";
import { formatDateTime } from "@alliance/shared/lib/dateFormatters";
import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
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
import {
  ArmChangeKind,
  useCohortDecisionsAdmin,
} from "../lib/useCohortDecisionsAdmin";
import { suiteSplitsQuery } from "../lib/useSuiteSplitsAdmin";
import { ArmChangeModal, type SplitArmOption } from "./ArmChangeModal";
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
  split,
}: {
  actionId: number;
  split: { suiteId: number; splitId: number } | null;
}) {
  const [search, setSearch] = useState("");
  const [correcting, setCorrecting] = useState<CohortDecisionDto | null>(null);
  const [changingArm, setChangingArm] = useState<{
    kind: ArmChangeKind;
    decision: CohortDecisionDto;
  } | null>(null);

  const decisions = useCohortDecisionsAdmin(actionId);
  const splits = useQuery({
    ...suiteSplitsQuery(split?.suiteId ?? 0),
    enabled: split !== null,
  });
  const actionList = useActionsAdmin();
  const arms: SplitArmOption[] | undefined = splits.data
    ?.find((candidate) => candidate.id === split?.splitId)
    ?.arms.map((arm) => ({
      actionId: arm.actionId,
      name:
        actionList.data?.find((action) => action.id === arm.actionId)?.name ??
        `Action #${arm.actionId}`,
    }));

  if (decisions.isPending || (split && splits.isPending)) return <Spinner />;
  if (split && (splits.isError || !arms)) {
    return (
      <InlineError
        message={
          splits.isError
            ? errorMessage({
                error: splits.error,
                fallback: "Could not load the action's split",
              })
            : "This action's split is gone. Reload the page."
        }
      />
    );
  }
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
                {arms ? (
                  <div className="flex justify-end gap-2">
                    <Button
                      color={ButtonColor.White}
                      size="small"
                      aria-label={`Move ${row.userName} to another arm`}
                      onClick={() =>
                        setChangingArm({
                          kind: ArmChangeKind.Move,
                          decision: row,
                        })
                      }
                    >
                      Move to arm
                    </Button>
                    <Button
                      color={ButtonColor.White}
                      size="small"
                      aria-label={`Remove ${row.userName} from the split`}
                      onClick={() =>
                        setChangingArm({
                          kind: ArmChangeKind.Remove,
                          decision: row,
                        })
                      }
                    >
                      Remove from split
                    </Button>
                  </div>
                ) : (
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
                )}
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
      {changingArm && arms && (
        <ArmChangeModal
          kind={changingArm.kind}
          actionId={actionId}
          decision={changingArm.decision}
          arms={arms}
          onClose={() => setChangingArm(null)}
        />
      )}
    </div>
  );
}
