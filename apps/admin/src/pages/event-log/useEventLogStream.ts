import type { EventLogDto } from "@alliance/shared/client/types.gen";
import { milliseconds } from "date-fns";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  type EventLogWsEvent,
  useEventLogWebSocket,
} from "../../lib/useEventLogWebSocket";

const HIGHLIGHT_MS = milliseconds({ seconds: 5 });

export type EventRow = EventLogDto | EventLogWsEvent;

type Stream = {
  /** Page 1 as the table last took it from a fetch. */
  fetched: EventLogDto[] | undefined;
  /** Above `fetched` in the table, newest first. */
  shown: EventRow[];
  /** Arrived while the reader was in the list, newest first: not in the table yet. */
  held: EventRow[];
};

const EMPTY: Stream = { fetched: undefined, shown: [], held: [] };

/**
 * Page 1's rows while `enabled`: the `fetched` page with events arriving over
 * the socket, or in a refetch, above it. One that arrives while `isReading()`
 * is held instead of shown, so the rows being read don't move; the next one to
 * arrive while not reading, or `showHeld`, shows them all. The server doesn't
 * replay events sent while the socket was down, so a reconnect calls
 * `onReconnect` to refetch them.
 */
export function useEventLogStream({
  enabled,
  fetched,
  isReading,
  onReconnect,
}: {
  enabled: boolean;
  /** Page 1 from the server; undefined while another page stands in for it. */
  fetched: EventLogDto[] | undefined;
  isReading: () => boolean;
  onReconnect: () => void;
}) {
  const { isConnected, setOnNewEvent } = useEventLogWebSocket();
  const [stream, setStream] = useState(EMPTY);
  const [highlighted, setHighlighted] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const [announcement, setAnnouncement] = useState("");

  const isReadingRef = useRef(isReading);
  const onReconnectRef = useRef(onReconnect);
  useEffect(() => {
    isReadingRef.current = isReading;
    onReconnectRef.current = onReconnect;
  });

  const wasConnected = useRef(false);
  useEffect(() => {
    if (!isConnected) return;
    if (wasConnected.current && enabled) onReconnectRef.current();
    wasConnected.current = true;
  }, [isConnected, enabled]);

  useEffect(() => {
    if (!enabled) return;
    setOnNewEvent((event) => {
      const text = `New event: ${event.message}`;
      // An unchanged live region isn't announced again, so a repeat of the
      // same message alternates a trailing no-break space.
      setAnnouncement((prev) => (prev === text ? `${text}\u00a0` : text));
      const reading = isReadingRef.current();
      setStream((prev) =>
        reading
          ? { ...prev, held: [event, ...prev.held] }
          : { ...prev, shown: [event, ...prev.held, ...prev.shown], held: [] },
      );
    });
    return () => {
      setOnNewEvent(null);
      setStream(EMPTY);
      setAnnouncement("");
    };
  }, [enabled, setOnNewEvent]);

  // A layout effect, so a refetch's arrivals never paint above the rows read.
  useLayoutEffect(() => {
    if (!enabled || !fetched) return;
    const reading = isReadingRef.current();
    setStream((prev) => {
      if (!prev.fetched || !reading) return { ...prev, fetched };
      const onScreen = ids([...prev.shown, ...prev.fetched]);
      const firstOnScreen = fetched.findIndex((event) =>
        onScreen.has(event.id),
      );
      const held = ids(prev.held);
      const arrivals = fetched
        .slice(0, firstOnScreen === -1 ? undefined : firstOnScreen)
        .filter((event) => !held.has(event.id));
      return arrivals.length === 0
        ? prev
        : { ...prev, held: [...arrivals, ...prev.held] };
    });
  }, [enabled, fetched]);

  const highlightedOnce = useRef(new Set<string>());
  const timeouts = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const ids = stream.shown
      .map((event) => event.id)
      .filter((id) => !highlightedOnce.current.has(id));
    if (ids.length === 0) return;
    ids.forEach((id) => highlightedOnce.current.add(id));
    setHighlighted((prev) => new Set([...prev, ...ids]));
    const timeout = setTimeout(() => {
      timeouts.current.delete(timeout);
      setHighlighted((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }, HIGHLIGHT_MS);
    timeouts.current.add(timeout);
  }, [stream.shown]);
  useEffect(() => {
    const pending = timeouts.current;
    return () => pending.forEach((timeout) => clearTimeout(timeout));
  }, []);

  const showHeld = useCallback(
    () =>
      setStream((prev) => ({
        ...prev,
        shown: [...prev.held, ...prev.shown],
        held: [],
      })),
    [],
  );

  // The fetch the table took can already have events the socket brought.
  const inFetched = ids(stream.fetched ?? []);
  const fresh = (events: EventRow[]) =>
    events.filter((event) => !inFetched.has(event.id));
  return {
    /** Undefined until page 1 is fetched. */
    rows:
      enabled && stream.fetched
        ? [...fresh(stream.shown), ...stream.fetched]
        : undefined,
    shown: stream.shown,
    held: fresh(stream.held),
    highlighted,
    announcement,
    isConnected,
    showHeld,
  };
}

const ids = (events: EventRow[]) => new Set(events.map((event) => event.id));
