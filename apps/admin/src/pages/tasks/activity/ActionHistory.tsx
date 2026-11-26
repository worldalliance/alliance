import { formatDateTime } from "../../../lib/formatDate";
import { LAUNCH_TIME_ZONE } from "../../../lib/launchTimeZone";
import Badge, { BadgeTone } from "../../../ui/Badge";
import { EmptyState } from "../../../ui/EmptyState";
import { phaseLabel } from "../../../ui/PhaseBadge";
import { linkClass } from "../../../ui/styles";
import { Panel } from "../../../ui/templates/Overview";
import type { TaskTab } from "../taskTabs";
import { HistoryKind, type HistoryRow } from "./activityRules";

const TARGET: Record<HistoryKind, TaskTab> = {
  [HistoryKind.Phase]: "events",
  [HistoryKind.Published]: "messages",
  [HistoryKind.Notified]: "messages",
};

const TARGET_LABEL: Record<HistoryKind, string> = {
  [HistoryKind.Phase]: "Open events",
  [HistoryKind.Published]: "Open messages",
  [HistoryKind.Notified]: "Open messages",
};

const sentence = (row: HistoryRow): string => {
  switch (row.kind) {
    case HistoryKind.Phase:
      return row.status
        ? `${phaseLabel(row.status)} ${row.scheduled ? "starts" : "started"}`
        : "Phase change";
    case HistoryKind.Published:
      return `Project update “${row.title}” ${row.scheduled ? "will be visible to members" : "became visible to members"}`;
    case HistoryKind.Notified:
      return `Notification of “${row.title}” sent`;
    default:
      throw new Error(`unknown kind: ${row.kind satisfies never}`);
  }
};

export function ActionHistory({
  rows,
  openTab,
}: {
  rows: HistoryRow[];
  openTab: (tab: TaskTab) => void;
}) {
  return (
    <Panel
      title="History"
      description="From the task's events and project updates, newest first."
      flush
    >
      {rows.length === 0 ? (
        <EmptyState
          title="Nothing has happened yet"
          description="Phase starts and published project updates appear here."
        />
      ) : (
        <ol className="divide-y divide-line">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-card py-2"
            >
              <span className="w-56 shrink-0 text-fg-muted tabular-nums">
                {formatDateTime(row.at, {
                  weekday: true,
                  timeZone: LAUNCH_TIME_ZONE,
                })}
              </span>
              {row.scheduled && <Badge tone={BadgeTone.Info}>Scheduled</Badge>}
              <span className="min-w-0 flex-1">{sentence(row)}</span>
              <button
                type="button"
                className={linkClass}
                onClick={() => openTab(TARGET[row.kind])}
              >
                {TARGET_LABEL[row.kind]}
              </button>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
