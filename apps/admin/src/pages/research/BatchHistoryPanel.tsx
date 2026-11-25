import { KoraBatchEventKind } from "@alliance/common/kora";
import type { KoraBatchEventDto } from "@alliance/shared/client";
import { useId, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { formatDateTime } from "../../lib/formatDate";
import { countOf } from "../../lib/formatNumber";
import { koraAssignmentHref } from "../../lib/hrefs";
import { useKoraBatchEvents } from "../../lib/useKoraBatchesAdmin";
import { Select } from "../../ui/Select";
import { linkClass } from "../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Panel } from "../../ui/templates/Overview";
import { ContentState, TableSkeleton } from "../../ui/templates/States";

enum EventFilter {
  All = "all",
  Batch = "batch",
  Rating = "rating",
}

const FILTER_LABEL: Record<EventFilter, string> = {
  [EventFilter.All]: "All",
  [EventFilter.Batch]: "Batch actions",
  [EventFilter.Rating]: "Rating submissions",
};

const IS_RATING: Record<KoraBatchEventKind, boolean> = {
  [KoraBatchEventKind.Upload]: false,
  [KoraBatchEventKind.Retire]: false,
  [KoraBatchEventKind.Reactivate]: false,
  [KoraBatchEventKind.Delete]: false,
  [KoraBatchEventKind.AssignmentCompleted]: true,
};

const SHOWS: Record<EventFilter, (event: KoraBatchEventDto) => boolean> = {
  [EventFilter.All]: () => true,
  [EventFilter.Batch]: (e) => !IS_RATING[e.kind],
  [EventFilter.Rating]: (e) => IS_RATING[e.kind],
};

const pairs = (n: number | null) => countOf(n ?? 0, "chat pair");
const whoDid = (event: KoraBatchEventDto) => event.adminName ?? "An admin";
const batchOf = (event: KoraBatchEventDto) =>
  event.batchUploadedAt
    ? `the batch uploaded ${formatDateTime(event.batchUploadedAt)}`
    : "a batch";

const DESCRIBE: Record<
  KoraBatchEventKind,
  (event: KoraBatchEventDto) => ReactNode
> = {
  [KoraBatchEventKind.Upload]: (e) =>
    `${whoDid(e)} uploaded a batch of ${pairs(e.transcriptCount)}`,
  [KoraBatchEventKind.Retire]: (e) => `${whoDid(e)} retired ${batchOf(e)}`,
  [KoraBatchEventKind.Reactivate]: (e) =>
    `${whoDid(e)} reactivated ${batchOf(e)}`,
  [KoraBatchEventKind.Delete]: (e) =>
    `${whoDid(e)} deleted ${batchOf(e)}, removing ${pairs(e.transcriptCount)}, ${countOf(e.ratingCount ?? 0, "rating")} and ${countOf(e.assignmentCount ?? 0, "volunteer assignment")}`,
  [KoraBatchEventKind.AssignmentCompleted]: (e) => (
    <>
      Reviewer {e.reviewerId?.slice(0, 8)} completed an assignment, rating{" "}
      {pairs(e.ratingCount)}.{" "}
      {e.assignmentDeleted || !e.assignmentId ? (
        "The assignment has since been deleted."
      ) : (
        <Link className={linkClass} to={koraAssignmentHref(e.assignmentId)}>
          View its export
        </Link>
      )}
    </>
  ),
};

const COLUMNS = ["w-44"];

export function BatchHistoryPanel() {
  const events = useKoraBatchEvents();
  const [filter, setFilter] = useState(EventFilter.All);
  const filterId = useId();
  const shown = (events.data ?? []).filter(SHOWS[filter]);

  return (
    <Panel
      title="History"
      flush
      action={
        <div className="flex items-center gap-2">
          <label htmlFor={filterId} className="text-fg-muted">
            Show
          </label>
          <Select
            id={filterId}
            className="h-control-sm w-auto"
            value={filter}
            onChange={(e) =>
              setFilter(
                Object.values(EventFilter).find((f) => f === e.target.value) ??
                  EventFilter.All,
              )
            }
          >
            {Object.values(EventFilter).map((f) => (
              <option key={f} value={f}>
                {FILTER_LABEL[f]}
              </option>
            ))}
          </Select>
        </div>
      }
    >
      <ContentState
        things="the history"
        query={events}
        skeleton={
          <TableSkeleton columns={2} rows={4} columnClassNames={COLUMNS} />
        }
        empty={shown.length === 0}
        filtered={filter !== EventFilter.All}
        onClearFilters={() => setFilter(EventFilter.All)}
        emptyTitle="Nothing yet"
        emptyDescription="Uploads, retires, reactivations, deletes and finished assignments show here."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className={COLUMNS[0]}>When</TableHead>
              <TableHead>What happened</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDateTime(event.createdAt)}
                </TableCell>
                <TableCell>{DESCRIBE[event.kind](event)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ContentState>
    </Panel>
  );
}
