import { KoraBatchEventKind } from "@alliance/common/kora";
import type { KoraBatchEventDto } from "@alliance/shared/client";
import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { formatKoraDate } from "../lib/koraParticipants";
import { useKoraBatchEvents } from "../lib/useKoraBatchesAdmin";
import { countOf } from "./KoraBatchActions";

const CELL = "px-3 py-2 align-top";

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

const shows = (filter: EventFilter, event: KoraBatchEventDto): boolean => {
  switch (filter) {
    case EventFilter.All:
      return true;
    case EventFilter.Batch:
      return !IS_RATING[event.kind];
    case EventFilter.Rating:
      return IS_RATING[event.kind];
    default:
      throw new Error(`unknown filter: ${filter satisfies never}`);
  }
};

const pairs = (n: number | null) => countOf(n ?? 0, "chat pair", "chat pairs");

const whoDid = (event: KoraBatchEventDto) => event.adminName ?? "An admin";
const batchOf = (event: KoraBatchEventDto) =>
  event.batchUploadedAt
    ? `the batch uploaded ${formatKoraDate(event.batchUploadedAt)}`
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
    `${whoDid(e)} deleted ${batchOf(e)}, removing ${pairs(e.transcriptCount)}, ${countOf(e.ratingCount ?? 0, "rating", "ratings")} and ${countOf(e.assignmentCount ?? 0, "volunteer assignment", "volunteer assignments")}`,
  [KoraBatchEventKind.AssignmentCompleted]: (e) => (
    <>
      Reviewer {e.reviewerId?.slice(0, 8)} completed an assignment, rating{" "}
      {pairs(e.ratingCount)}.{" "}
      {e.assignmentDeleted || !e.assignmentId ? (
        "The assignment has since been deleted."
      ) : (
        <Link
          className="underline"
          to={`/kora-participants/assignments/${e.assignmentId}`}
        >
          View its export
        </Link>
      )}
    </>
  ),
};

export function KoraBatchEvents() {
  const events = useKoraBatchEvents();
  const [filter, setFilter] = useState(EventFilter.All);

  const body = () => {
    if (events.isPending) return <p className="text-sm">Loading history…</p>;
    if (events.isError) {
      return (
        <p className="text-sm text-red-600" role="alert">
          {adminRefusalMessage(
            events.error,
            "Couldn't load the history. Reload to try again.",
          )}
        </p>
      );
    }
    const shown = events.data.filter((e) => shows(filter, e));
    if (shown.length === 0) {
      return (
        <p className="text-sm text-zinc-600">
          {events.data.length === 0
            ? "Nothing yet. Uploads, retires, reactivations and deletes show here."
            : `No ${FILTER_LABEL[filter].toLowerCase()} yet.`}
        </p>
      );
    }
    return (
      <table className="text-sm">
        <thead className="text-left text-zinc-500">
          <tr>
            <th className={CELL}>When</th>
            <th className={CELL}>What happened</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((event) => (
            <tr key={event.id} className="border-t border-zinc-200">
              <td className={`${CELL} whitespace-nowrap`}>
                {formatKoraDate(event.createdAt)}
              </td>
              <td className={CELL}>{DESCRIBE[event.kind](event)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <section aria-labelledby="kora-batch-history" className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <h3 id="kora-batch-history" className="font-semibold">
          History
        </h3>
        <label className="text-sm">
          Show{" "}
          <select
            className="ml-1 rounded border border-zinc-300 bg-white px-2 py-1"
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
          </select>
        </label>
      </div>
      {body()}
    </section>
  );
}
