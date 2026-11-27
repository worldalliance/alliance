import type { NeedsReplyThreadDto } from "@alliance/shared/client/types.gen";
import {
  type FocusEvent,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

export type HeldRow = { thread: NeedsReplyThreadDto; left: boolean };

const subscribeToVisibility = (onChange: () => void) => {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
};

const nextRows = (params: {
  shown: HeldRow[];
  threads: NeedsReplyThreadDto[];
  held: boolean;
}): HeldRow[] => {
  const { shown, threads, held } = params;
  if (!held) return threads.map((thread) => ({ thread, left: false }));
  const latest = new Map(threads.map((t) => [t.threadId, t]));
  const kept = shown.map((row): HeldRow => {
    const thread = latest.get(row.thread.threadId);
    return thread ? { thread, left: false } : { ...row, left: true };
  });
  const keptIds = new Set(shown.map((row) => row.thread.threadId));
  return [
    ...kept,
    ...threads
      .filter((t) => !keptIds.has(t.threadId))
      .map((thread) => ({ thread, left: false })),
  ];
};

/**
 * So a poll never moves the row about to be clicked: while the pointer is
 * over the list, or a row has keyboard focus, and the tab is visible, rows
 * keep their order, a number no longer waiting stays as `left`, and arrivals
 * go below. Spread `listProps` on the element holding the rows.
 */
export function useHeldRows(threads: NeedsReplyThreadDto[] | undefined) {
  const [pointerIn, setPointerIn] = useState(false);
  const [focusIn, setFocusIn] = useState(false);
  const hidden = useSyncExternalStore(
    subscribeToVisibility,
    () => document.hidden,
  );
  const held = (pointerIn || focusIn) && !hidden;
  const [shown, setShown] = useState<{
    threads?: NeedsReplyThreadDto[];
    held: boolean;
    rows: HeldRow[];
  }>({ held: false, rows: [] });
  let rows = shown.rows;
  if (threads && (shown.threads !== threads || shown.held !== held)) {
    rows = nextRows({ shown: shown.rows, threads, held });
    setShown({ threads, held, rows });
  }
  const list = useRef<HTMLDivElement>(null);
  // React fires no blur for a focused row that unmounts, and every unmount
  // changes rows.
  useLayoutEffect(() => {
    if (focusIn && !list.current?.contains(document.activeElement)) {
      setFocusIn(false);
    }
  }, [focusIn, rows]);
  const listProps = {
    ref: list,
    onPointerEnter: () => setPointerIn(true),
    onPointerLeave: () => setPointerIn(false),
    onFocus: (e: FocusEvent) => setFocusIn(e.target.matches(":focus-visible")),
    onBlur: (e: FocusEvent) => {
      const to = e.relatedTarget;
      if (!(to instanceof Node && e.currentTarget.contains(to))) {
        setFocusIn(false);
      }
    },
  };
  return { rows, listProps };
}
