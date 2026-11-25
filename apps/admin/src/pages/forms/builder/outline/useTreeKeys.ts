import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import type { ElementActions } from "../inspector/ElementActionsMenu";
import { focusInPlace, revealInPane } from "../kit/revealInPane";

/** What the keyboard can do to one row of the tree. */
export type RowHandle = {
  select: () => void;
  /** Extends the selection through the row; absent where ranges can't reach it. */
  extend?: () => void;
  /** Absent on a row with nothing to show or hide. */
  toggle?: () => void;
  expanded?: boolean;
  current: boolean;
};

const ROW = '[role="treeitem"]';

/** The pane the outline scrolls in. BACKCOMPAT(builder-pane-refs): a ref from `Workspace` once ask builder-02 lands. */
export const outlinePane = (el: Element | null) =>
  el?.closest<HTMLElement>(".overflow-y-auto") ?? null;

const levelOf = (row: Element) => Number(row.getAttribute("aria-level"));

/**
 * The outline's keys, on the tree: arrows, Home and End move focus and the
 * selection with it; → and ← open, close, and step in and out; Shift+arrows
 * extend a range; Alt+arrows move the selection; Delete deletes it.
 * Every move of focus scrolls only the outline, and only as far as the row.
 */
export function useTreeKeys({
  tree,
  handles,
  actions,
}: {
  tree: RefObject<HTMLElement | null>;
  /** Each rendered row's handle, by its `data-row-key`. */
  handles: ReadonlyMap<string, RowHandle>;
  /** The selection's actions; null where its own settings offer them. */
  actions: ElementActions | null;
}) {
  const latest = useRef(handles);
  useEffect(() => {
    latest.current = handles;
  });

  const rows = () => [
    ...(tree.current?.querySelectorAll<HTMLElement>(ROW) ?? []),
  ];
  const handleOf = (row: HTMLElement | undefined) =>
    row && latest.current.get(row.dataset.rowKey ?? "");

  const go = (
    row: HTMLElement | undefined,
    run: (handle: RowHandle) => void,
  ) => {
    const handle = handleOf(row);
    if (!row || !handle) return;
    focusInPlace(row);
    const pane = outlinePane(row);
    if (pane) revealInPane(pane, row, 8);
    run(handle);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!(event.target instanceof HTMLElement)) return;
    const row = event.target.closest<HTMLElement>(ROW);
    if (!row || row !== event.target) return;
    const handle = handleOf(row);
    if (!handle) return;
    const all = rows();
    const at = all.indexOf(row);
    const select = (next: RowHandle) => next.select();
    const run = (action: (() => void) | null | undefined) => {
      if (handle.current && action) action();
    };
    const keys: Record<string, (() => void) | undefined> = {
      ArrowDown: () => go(all[at + 1], select),
      ArrowUp: () => go(all[at - 1], select),
      Home: () => go(all[0], select),
      End: () => go(all.at(-1), select),
      "Shift+ArrowDown": () => go(all[at + 1], (next) => next.extend?.()),
      "Shift+ArrowUp": () => go(all[at - 1], (next) => next.extend?.()),
      "Alt+ArrowUp": () => run(actions?.onMoveUp),
      "Alt+ArrowDown": () => run(actions?.onMoveDown),
      ArrowRight: () => {
        if (!handle.toggle) return;
        if (!handle.expanded) handle.toggle();
        else go(all[at + 1], select);
      },
      ArrowLeft: () => {
        if (handle.toggle && handle.expanded) return handle.toggle();
        const level = levelOf(row);
        const parent = all
          .slice(0, at)
          .reverse()
          .find((candidate) => levelOf(candidate) < level);
        go(parent, select);
      },
      Enter: handle.select,
      "Shift+Enter": handle.extend ?? handle.select,
      " ": handle.select,
      Delete: () => run(actions?.onDelete),
      Backspace: () => run(actions?.onDelete),
    };
    const name = `${event.altKey ? "Alt+" : ""}${event.shiftKey ? "Shift+" : ""}${event.key}`;
    const action = event.metaKey || event.ctrlKey ? undefined : keys[name];
    if (!action) return;
    event.preventDefault();
    action();
  };

  return onKeyDown;
}
