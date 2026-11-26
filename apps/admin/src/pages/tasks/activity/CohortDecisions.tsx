import type { CohortDecisionDto } from "@alliance/shared/client";
import { useState } from "react";
import { Link } from "react-router";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { formatDateTime } from "../../../lib/formatDate";
import { memberHref } from "../../../lib/hrefs";
import { useCohortDecisionsAdmin } from "../../../lib/useCohortDecisionsAdmin";
import Badge, { BadgeTone } from "../../../ui/Badge";
import Button from "../../../ui/Button";
import { nameLinkClass } from "../../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../ui/Table";
import { SearchField } from "../../../ui/templates/List";
import { Panel } from "../../../ui/templates/Overview";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../../ui/templates/States";
import { decisionLabel, REASON_LABELS } from "./activityRules";
import { CorrectDecisionDialog } from "./CorrectDecisionDialog";

export function CohortDecisions({
  actionId,
  emptyReason,
}: {
  actionId: number;
  /** Why no decision exists yet, for a task with none. */
  emptyReason: string;
}) {
  const [search, setSearch] = useState("");
  const [correcting, setCorrecting] = useState<CohortDecisionDto | null>(null);
  const decisions = useCohortDecisionsAdmin(actionId);

  const rows = decisions.data ?? [];
  const assigned = rows.filter((row) => row.included).length;
  const query = search.trim().toLowerCase();
  const visible = query
    ? rows.filter((row) => row.userName.toLowerCase().includes(query))
    : rows;

  return (
    <Panel
      title="Cohort decisions"
      description={
        decisions.data &&
        `${assigned} assigned, ${rows.length - assigned} excluded. Members without a decision are not listed.`
      }
      action={
        rows.length > 0 && (
          <SearchField
            label="Search members"
            value={search}
            onChange={setSearch}
          />
        )
      }
      flush
    >
      <RefreshFailedBanner things="cohort decisions" query={decisions} inline />
      <ContentState
        loading={decisions.isPending}
        skeleton={<TableSkeleton columns={5} rows={5} bleed />}
        error={
          decisions.isLoadingError
            ? adminRefusalMessage(decisions.error, LOAD_FAILED_FALLBACK)
            : null
        }
        errorTitle="Couldn't load cohort decisions"
        onRetry={() => void decisions.refetch()}
        retrying={decisions.isFetching}
        empty={visible.length === 0}
        filtered={rows.length > 0}
        onClearFilters={() => setSearch("")}
        emptyTitle="No decisions yet"
        emptyDescription={emptyReason}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Decision</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Resolved</TableHead>
              <TableHead actions>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((row) => (
              <TableRow key={row.userId}>
                <TableCell className="align-top">
                  <Link to={memberHref(row.userId)} className={nameLinkClass}>
                    {row.userName}
                  </Link>
                  {row.corrections.map((correction) => (
                    <p
                      key={correction.correctedAt}
                      className="mt-1 text-caption text-fg-muted"
                    >
                      Was {decisionLabel(correction.previousIncluded)} (
                      {REASON_LABELS[correction.previousReason]},{" "}
                      {formatDateTime(correction.previousResolvedAt)}).{" "}
                      {correction.correctedByName ?? "Deleted user"},{" "}
                      {formatDateTime(correction.correctedAt)}:{" "}
                      {correction.note}
                    </p>
                  ))}
                </TableCell>
                <TableCell className="align-top">
                  <Badge
                    tone={row.included ? BadgeTone.Success : BadgeTone.Neutral}
                  >
                    {decisionLabel(row.included)}
                  </Badge>
                </TableCell>
                <TableCell className="align-top">
                  {REASON_LABELS[row.reason]}
                </TableCell>
                <TableCell className="align-top tabular-nums">
                  {formatDateTime(row.resolvedAt)}
                </TableCell>
                <TableCell actions className="align-top">
                  <Button
                    size="small"
                    aria-label={`Correct ${row.userName}'s decision`}
                    onClick={() => setCorrecting(row)}
                  >
                    Correct decision
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ContentState>
      {correcting && (
        <CorrectDecisionDialog
          actionId={actionId}
          decision={correcting}
          onClose={() => setCorrecting(null)}
        />
      )}
    </Panel>
  );
}
