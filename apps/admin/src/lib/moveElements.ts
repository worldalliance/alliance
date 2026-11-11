import type { Page } from "@alliance/common/forms/form-schema";
import { moveSpan } from "./useDragReorder";

/** Top-level elements `start` up to, not including, `end`, on one page. */
export type ElementSpan = { pageIndex: number; start: number; end: number };

/** The gap before `index` in the page's elements as they stand before the move. */
export type ElementDrop = { pageIndex: number; index: number };

/**
 * Moves the elements in `from` to the gap at `to`, on the same page or
 * another, keeping their order. Null when the move leaves them where they were.
 */
export function moveElements({
  pages,
  from,
  to,
}: {
  pages: readonly Page[];
  from: ElementSpan;
  to: ElementDrop;
}): Page[] | null {
  const source = pages[from.pageIndex];
  const destination = pages[to.pageIndex];
  if (
    !source ||
    !destination ||
    from.start < 0 ||
    from.start >= from.end ||
    from.end > source.fields.length ||
    to.index < 0 ||
    to.index > destination.fields.length
  ) {
    throw new Error(`invalid move: ${JSON.stringify({ from, to })}`);
  }
  if (from.pageIndex === to.pageIndex) {
    const moved = moveSpan({
      items: source.fields,
      start: from.start,
      end: from.end,
      index: to.index,
    });
    return (
      moved &&
      pages.map((page, index) =>
        index === to.pageIndex ? { ...page, fields: moved.items } : page,
      )
    );
  }

  const remaining = [
    ...source.fields.slice(0, from.start),
    ...source.fields.slice(from.end),
  ];
  const landed = [
    ...destination.fields.slice(0, to.index),
    ...source.fields.slice(from.start, from.end),
    ...destination.fields.slice(to.index),
  ];
  return pages.map((page, index) =>
    index === to.pageIndex
      ? { ...page, fields: landed }
      : index === from.pageIndex
        ? { ...page, fields: remaining }
        : page,
  );
}
