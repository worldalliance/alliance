import type { EventType } from "@alliance/shared/client/types.gen";
import { prefersReducedMotion } from "@alliance/sharedweb/lib/reducedMotion";
import { milliseconds } from "date-fns";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { formatCount } from "../../lib/formatNumber";
import { memberHref } from "../../lib/hrefs";
import { PlaceId } from "../../places";
import Badge, { BadgeTone } from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import Pagination from "../../ui/Pagination";
import { Select } from "../../ui/Select";
import { linkClass } from "../../ui/styles";
import {
  ExpandToggle,
  Table,
  TableBody,
  TableCell,
  TableDetailRow,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import {
  FilterBar,
  FilterChip,
  ListContent,
  listCount,
  ListFooter,
} from "../../ui/templates/List";
import { Page } from "../../ui/templates/Page";
import {
  ContentState,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import { useDelayedFlag } from "../../ui/templates/useDelayedFlag";
import {
  EVENT_TYPE_LABELS,
  EVENT_TYPE_OPTIONS,
  eventTime,
  eventTypeLabel,
  isEventType,
} from "./eventLogRules";
import { useEventLogList } from "./useEventLogList";
import { type EventRow, useEventLogStream } from "./useEventLogStream";

// The table's layout is fixed, so a streamed row with a longer name or message
// can't resize the columns under the rows being read.
const COLUMN_CLASSES = [undefined, "w-56", "w-40", "w-44", "w-28"] as const;
const COLUMNS = COLUMN_CLASSES.length;

enum StreamStatus {
  Live = "live",
  Off = "off",
  Connecting = "connecting",
  Disconnected = "disconnected",
}

const STREAM_STATUS: Record<StreamStatus, { label: string; tone: BadgeTone }> =
  {
    [StreamStatus.Live]: { label: "Live", tone: BadgeTone.Success },
    [StreamStatus.Off]: { label: "Not live", tone: BadgeTone.Neutral },
    [StreamStatus.Connecting]: {
      label: "Connecting",
      tone: BadgeTone.Neutral,
    },
    [StreamStatus.Disconnected]: {
      label: "Disconnected",
      tone: BadgeTone.Warning,
    },
  };

const DISCONNECTED_AFTER_MS = milliseconds({ seconds: 3 });
const TICK_MS = milliseconds({ seconds: 30 });

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

export default function EventLogPage() {
  const events = useEventLogList();
  const { data, page, setPage, type, setType } = events;
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const now = useNow();
  const selectRef = useRef<HTMLSelectElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // `ListContent` is the region that scrolls, and the list is its child.
  const scroller = () => listRef.current?.parentElement;

  const streaming = page === 1 && type === "";
  const stream = useEventLogStream({
    enabled: streaming,
    fetched: events.isPlaceholderData ? undefined : data?.items,
    isReading: () => {
      const list = listRef.current;
      if (!list) return false;
      const focused = document.activeElement;
      return (
        rows.some((event) => expanded.has(event.id)) ||
        (scroller()?.scrollTop ?? 0) > 0 ||
        list.matches(":hover") ||
        (focused !== list && list.contains(focused))
      );
    },
    onReconnect: () => void events.refetch(),
  });
  const disconnected = useDelayedFlag(
    streaming && !stream.isConnected,
    DISCONNECTED_AFTER_MS,
  );
  const status = !streaming
    ? StreamStatus.Off
    : stream.isConnected
      ? StreamStatus.Live
      : disconnected
        ? StreamStatus.Disconnected
        : StreamStatus.Connecting;

  const rows: EventRow[] = stream.rows ?? data?.items ?? [];
  const { held } = stream;
  // The count includes events the socket brought that the last fetch missed.
  const latest = new Set((data?.items ?? []).map((event) => event.id));
  const total =
    data &&
    data.totalCount +
      [...stream.shown, ...held].filter((event) => !latest.has(event.id))
        .length;

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const toTop = (behavior: ScrollBehavior = "instant") =>
    scroller()?.scrollTo({ top: 0, behavior });
  const glideToTop = () => toTop(prefersReducedMotion() ? "instant" : "smooth");
  const chooseType = (next: EventType | "") => {
    setType(next);
    glideToTop();
  };
  const clearType = () => {
    chooseType("");
    selectRef.current?.focus();
  };

  return (
    <Page
      fill
      place={PlaceId.EventLog}
      badge={
        <Badge tone={STREAM_STATUS[status].tone}>
          {STREAM_STATUS[status].label}
        </Badge>
      }
      description="System events, newest first. New events arrive at the top of the first page while no event type is chosen."
      banner={<RefreshFailedBanner things="events" query={events} />}
    >
      <FilterBar count={listCount({ shown: total ?? 0, total, noun: "event" })}>
        <Select
          ref={selectRef}
          aria-label="Event type"
          className="h-control-sm w-64"
          value={type}
          onChange={(event) => {
            const next = event.target.value;
            chooseType(isEventType(next) ? next : "");
          }}
        >
          <option value="">All event types</option>
          {EVENT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        {type !== "" && (
          <FilterChip
            field="Event type"
            value={EVENT_TYPE_LABELS[type]}
            onRemove={clearType}
          />
        )}
        {held.length > 0 && (
          <Button
            size="small"
            variant={ButtonVariant.Default}
            onClick={() => {
              stream.showHeld();
              glideToTop();
              // The button unmounts with nothing left to show. A focus that
              // scrolls cancels the smooth scroll above.
              listRef.current?.focus({ preventScroll: true });
            }}
          >
            Show {formatCount(held.length)} new{" "}
            {held.length === 1 ? "event" : "events"}
          </Button>
        )}
        <p role="status" className="sr-only">
          {stream.announcement}
        </p>
      </FilterBar>
      <ListContent>
        <ContentState
          things="events"
          query={events}
          refreshBanner={false}
          skeleton={
            <TableSkeleton
              bleed
              columns={COLUMNS}
              columnClassNames={COLUMN_CLASSES}
            />
          }
          empty={rows.length === 0}
          filtered={type !== ""}
          onClearFilters={clearType}
          emptyTitle="No events yet"
        >
          <div
            ref={listRef}
            tabIndex={-1}
            aria-busy={events.isPlaceholderData}
            className={cn(
              "outline-hidden transition-opacity duration-base ease-standard",
              events.isPlaceholderData && "opacity-60",
            )}
          >
            <Table bleed className="min-w-3xl table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead className={COLUMN_CLASSES[1]}>Type</TableHead>
                  <TableHead className={COLUMN_CLASSES[2]}>Member</TableHead>
                  <TableHead className={COLUMN_CLASSES[3]}>Time</TableHead>
                  <TableHead className={COLUMN_CLASSES[4]}>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((event) => (
                  <EventRows
                    key={event.id}
                    event={event}
                    now={now}
                    isNew={stream.highlighted.has(event.id)}
                    expanded={expanded.has(event.id)}
                    onToggle={() => toggle(event.id)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </ContentState>
      </ListContent>
      {data && data.totalPages > 1 && (
        <ListFooter>
          <span className="tabular-nums">
            Page {formatCount(page)} of {formatCount(data.totalPages)}
          </span>
          <Pagination
            page={page}
            totalPages={data.totalPages}
            onPageChange={(next) => {
              setPage(next);
              toTop();
            }}
          />
        </ListFooter>
      )}
    </Page>
  );
}

function EventRows({
  event,
  now,
  isNew,
  expanded,
  onToggle,
}: {
  event: EventRow;
  now: Date;
  /** Just arrived over the socket: tinted for a few seconds. */
  isNew: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const detailsId = useId();
  const time = eventTime(event.createdAt, now);
  const userId = event.userId ?? event.user?.id;
  return (
    <>
      <TableRow
        className={cn(
          "transition-colors duration-slow ease-standard",
          isNew && "bg-surface-2",
        )}
      >
        <TableCell className="truncate font-medium" title={event.message}>
          {event.message}
        </TableCell>
        <TableCell className="truncate">
          <Badge>{eventTypeLabel(event.event)}</Badge>
        </TableCell>
        <TableCell className="truncate" title={event.user?.displayName}>
          {event.user && userId != null ? (
            <Link to={memberHref(userId)} className={linkClass}>
              {event.user.displayName}
            </Link>
          ) : (
            "—"
          )}
        </TableCell>
        <TableCell className="whitespace-nowrap text-fg-muted">
          <time dateTime={event.createdAt} title={time.exact}>
            {time.text}
          </time>
        </TableCell>
        <TableCell>
          <ExpandToggle
            expanded={expanded}
            controls={detailsId}
            onToggle={onToggle}
            aria-label={`Details: ${event.message}`}
          >
            Details
          </ExpandToggle>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableDetailRow id={detailsId} colSpan={COLUMNS}>
          <dl className="flex flex-col gap-3">
            <Detail term="Message">
              <p className="max-w-prose wrap-anywhere whitespace-pre-wrap">
                {event.message}
              </p>
            </Detail>
            <Detail term="Time">{time.exact}</Detail>
            <Detail term="Data">
              {event.blob ? (
                <pre className="overflow-x-auto rounded-md bg-surface-2 p-3 font-mono text-xs">
                  {JSON.stringify(event.blob, null, 2)}
                </pre>
              ) : (
                "—"
              )}
            </Detail>
          </dl>
        </TableDetailRow>
      )}
    </>
  );
}

function Detail({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-caption font-medium text-fg-muted">{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}
