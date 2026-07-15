import { eventLogFindAllAdmin } from "@alliance/shared/client";
import type { EventLogDto, EventType } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { usePaginatedQuery } from "@alliance/shared/lib/usePaginatedQuery";
import { cn } from "@alliance/shared/styles/util";
import Pagination from "@alliance/sharedweb/ui/Pagination";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  useEventLogWebSocket,
  type EventLogWsEvent,
} from "../lib/useEventLogWebSocket";

const EVENT_TYPES: EventType[] = [
  "account_created",
  "contract_signed",
  "contract_suspended",
  "sms_unsubscribe",
  "sms_inbound",
  "sms_failure",
  "forum_action_autocomplete",
  "action_comment",
];

const EVENT_TYPE_COLORS: Record<string, string> = {
  account_created: "bg-green-100 text-green-800",
  contract_signed: "bg-blue-100 text-blue-800",
  contract_suspended: "bg-red-100 text-red-800",
  sms_unsubscribe: "bg-orange-100 text-orange-800",
  sms_inbound: "bg-purple-100 text-purple-800",
  sms_failure: "bg-red-100 text-red-700",
  forum_action_autocomplete: "bg-yellow-100 text-yellow-800",
  action_comment: "bg-indigo-100 text-indigo-800",
};

function formatEventType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const EVENTS_PER_PAGE = 50;

const EventLogPage: React.FC = () => {
  const [eventTypeFilter, setEventTypeFilter] = useState<EventType | "">("");
  const [liveEvents, setLiveEvents] = useState<EventLogWsEvent[]>([]);
  const [expandedBlobs, setExpandedBlobs] = useState<Set<string>>(new Set());
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());

  const { setOnNewEvent } = useEventLogWebSocket();

  const {
    data,
    page,
    setPage,
    isLoading,
    isError,
    isPlaceholderData,
    refetch,
  } = usePaginatedQuery({
    queryKey: (page) =>
      queryKeys.eventLogAdmin(page, EVENTS_PER_PAGE, eventTypeFilter),
    queryFn: (page) =>
      eventLogFindAllAdmin({
        query: {
          page,
          limit: EVENTS_PER_PAGE,
          ...(eventTypeFilter ? { eventType: eventTypeFilter } : {}),
        },
        throwOnError: true,
      }).then((response) => response.data),
  });

  // Track timeout refs for highlight cleanup
  const highlightTimeoutsRef = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());

  useEffect(() => {
    setOnNewEvent((event: EventLogWsEvent) => {
      // Only prepend live events when on page 1 with no filter
      if (page === 1 && !eventTypeFilter) {
        setLiveEvents((prev) => [event, ...prev]);
        setHighlightedIds((prev) => new Set(prev).add(event.id));
        const timeout = setTimeout(() => {
          setHighlightedIds((prev) => {
            const next = new Set(prev);
            next.delete(event.id);
            return next;
          });
        }, 5000);
        highlightTimeoutsRef.current.set(event.id, timeout);
      }
    });

    const timeouts = highlightTimeoutsRef.current;
    return () => {
      setOnNewEvent(null);
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [page, eventTypeFilter, setOnNewEvent]);

  // Clear live events when changing page/filter
  useEffect(() => {
    setLiveEvents([]);
  }, [page, eventTypeFilter]);

  const toggleBlob = (id: string) => {
    setExpandedBlobs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Background refetches (e.g. window refocus) return events already received
  // over the websocket, so drop live events the fetched page now contains.
  const fetchedIds = new Set((data?.items ?? []).map((event) => event.id));
  const allEvents: (EventLogDto | EventLogWsEvent)[] = [
    ...liveEvents.filter((event) => !fetchedIds.has(event.id)),
    ...(data?.items ?? []),
  ];

  return (
    <div className="p-6 pt-10 flex flex-col gap-6 ">
      <div className="flex flex-row justify-between items-center">
        <h2 className="text-xl font-semibold">Event Log</h2>
        <div className="flex items-center gap-3">
          <select
            className="text-sm border border-gray-2 text-black bg-white px-3 rounded-sm py-2 focus:outline-none focus:border-black"
            value={eventTypeFilter}
            onChange={(e) => {
              setEventTypeFilter(e.target.value as EventType | "");
              setPage(1);
            }}
          >
            <option value="">All event types</option>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatEventType(type)}
              </option>
            ))}
          </select>
          {eventTypeFilter && (
            <button
              type="button"
              className="text-sm text-zinc-500 hover:text-zinc-700 hover:underline"
              onClick={() => {
                setEventTypeFilter("");
                setPage(1);
              }}
            >
              Reset filter
            </button>
          )}
        </div>
      </div>

      {isError && (
        <p className="text-sm text-red-600">
          Failed to load events.{" "}
          <button
            type="button"
            className="underline hover:text-red-700"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </p>
      )}
      {isError && !data ? null : isLoading ? (
        <p className="text-sm text-zinc-500">Loading events...</p>
      ) : allEvents.length === 0 ? (
        <p className="text-sm text-zinc-500">No events found.</p>
      ) : (
        <>
          <div
            className={cn(
              "overflow-x-auto transition-opacity",
              isPlaceholderData && "opacity-60",
            )}
          >
            <table className="w-full text-sm text-left">
              <thead className="text-black border-b border-zinc-200">
                <tr>
                  <th className="py-3 px-2 font-medium">Type</th>
                  <th className="py-3 px-2 font-medium">Message</th>
                  <th className="py-3 px-2 font-medium">User</th>
                  <th className="py-3 px-2 font-medium">Time</th>
                  <th className="py-3 px-2 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {allEvents.map((event) => {
                  const isHighlighted = highlightedIds.has(event.id);
                  const isExpanded = expandedBlobs.has(event.id);
                  return (
                    <React.Fragment key={event.id}>
                      <tr
                        className={cn(
                          isExpanded ? "" : "border-b border-zinc-200",
                          "transition-colors duration-1000",
                          isHighlighted ? "bg-blue-50" : "hover:bg-zinc-50",
                        )}
                      >
                        <td className="py-3 px-2">
                          <span
                            className={cn(
                              "text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap",
                              EVENT_TYPE_COLORS[event.event] ??
                                "bg-gray-100 text-gray-800",
                            )}
                          >
                            {formatEventType(event.event)}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-zinc-800">
                          {event.message}
                        </td>
                        <td className="py-3 px-2 whitespace-nowrap">
                          {event.user ? (
                            <Link
                              to={`/member/${event.userId ?? event.user.id}`}
                              className="text-blue-600 hover:underline"
                            >
                              {event.user.displayName}
                            </Link>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-zinc-500 whitespace-nowrap">
                          {timeAgo(
                            typeof event.createdAt === "string"
                              ? event.createdAt
                              : (event.createdAt as Date).toISOString(),
                          )}
                        </td>
                        <td className="py-3 px-2">
                          {event.blob ? (
                            <button
                              type="button"
                              onClick={() => toggleBlob(event.id)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              {isExpanded ? "Hide" : "Show"}
                            </button>
                          ) : (
                            <span className="text-zinc-400">-</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && event.blob && (
                        <tr className="border-b border-zinc-200">
                          <td colSpan={5} className="px-2 pb-3">
                            <pre className="text-xs bg-zinc-100 rounded-md p-3 overflow-x-auto">
                              {JSON.stringify(event.blob, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-500">{data.totalCount} total</p>
              <Pagination
                page={page}
                totalPages={data.totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EventLogPage;
