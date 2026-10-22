import type { PageItem } from "@alliance/common/forms/form-schema";
import type { MouseEvent } from "react";
import { isTextEntry } from "../../lib/useDraftHistory";
import {
  addressOf,
  CanvasTargetKind,
  elementTarget,
  type CanvasTarget,
  type ResolvedTarget,
} from "./canvasSelection";

/** Top-level elements `start` up to, not including, `end`. */
export type Span = { start: number; end: number };

/** The top-level elements the selection covers, or null for the page. */
function selectedSpan(selected: ResolvedTarget): Span | null {
  switch (selected.kind) {
    case CanvasTargetKind.Page:
      return null;
    case CanvasTargetKind.Element:
      return { start: selected.index, end: selected.index + 1 };
    case CanvasTargetKind.Group:
    case CanvasTargetKind.Range:
      return { start: selected.start, end: selected.end };
    default:
      throw new Error(
        `unknown target: ${JSON.stringify(selected satisfies never)}`,
      );
  }
}

export const inRange = (selected: ResolvedTarget, index: number) =>
  selected.kind === CanvasTargetKind.Range &&
  index >= selected.start &&
  index < selected.end;

/** The end a range was last extended to, which a reveal scrolls to. */
export const rangeFocus = (selected: ResolvedTarget) =>
  selected.kind === CanvasTargetKind.Range
    ? selected.anchor === selected.start
      ? selected.end - 1
      : selected.start
    : null;

/** Stops Shift-click from selecting the text it passes over, outside text entry. */
const keepTextSelection = (event: MouseEvent) => {
  if (event.shiftKey && !isTextEntry(event.target)) event.preventDefault();
};

/** Handlers that select on a click and extend the selection on Shift-click. */
export const extendableClick = ({
  onSelect,
  onExtend,
}: {
  onSelect: () => void;
  onExtend: (() => void) | null | undefined;
}) => ({
  onMouseDown: onExtend ? keepTextSelection : undefined,
  onClick: (event: MouseEvent) =>
    event.shiftKey && onExtend ? onExtend() : onSelect(),
});

function rangeOver({
  fields,
  anchor,
  focus,
}: {
  fields: readonly PageItem[];
  anchor: number;
  focus: number;
}): CanvasTarget | null {
  const anchorItem = fields[anchor];
  const focusItem = fields[focus];
  return anchor !== focus && anchorItem?.id && focusItem?.id
    ? {
        kind: CanvasTargetKind.Range,
        anchor: addressOf(anchorItem, anchor),
        focus: addressOf(focusItem, focus),
      }
    : null;
}

/**
 * The range from the anchor through the whole of `clicked`, as Shift-click
 * makes it. A range keeps its anchor; otherwise the anchor is the selection's
 * end farthest from `clicked`. An anchor `clicked` surrounds gives way to the
 * range's start. Null where no range forms, so `clicked` is selected alone.
 */
export function extendSelection({
  fields,
  selected,
  clicked,
}: {
  fields: readonly PageItem[];
  selected: ResolvedTarget;
  clicked: Span;
}): CanvasTarget | null {
  const span = selectedSpan(selected);
  if (!span) return null;
  const kept =
    selected.kind === CanvasTargetKind.Range
      ? selected.anchor
      : clicked.start >= span.start
        ? span.start
        : span.end - 1;
  const start = Math.min(kept, clicked.start);
  const end = Math.max(kept + 1, clicked.end);
  return kept === end - 1
    ? rangeOver({ fields, anchor: end - 1, focus: start })
    : rangeOver({ fields, anchor: start, focus: end - 1 });
}

export enum CheckState {
  Unchecked = "unchecked",
  Checked = "checked",
  /** Inside the span, where unchecking would split it. */
  Locked = "locked",
  /** A block without an id outside the span, which no range can end on. */
  NoId = "noId",
  /** Outside a span that is one block without an id, which no range can start from. */
  BesideNoId = "besideNoId",
}

export function checkStateOf({
  fields,
  selected,
  index,
}: {
  fields: readonly PageItem[];
  selected: ResolvedTarget;
  index: number;
}): CheckState {
  const span = selectedSpan(selected);
  if (!span || index < span.start || index >= span.end) {
    if (span && !fields[index]?.id) return CheckState.NoId;
    return span && span.end - span.start === 1 && !fields[span.start]?.id
      ? CheckState.BesideNoId
      : CheckState.Unchecked;
  }
  return index === span.start || index === span.end - 1
    ? CheckState.Checked
    : CheckState.Locked;
}

/**
 * The selection once the element at `index` is checked, widening it to reach
 * the element, or unchecked, dropping it from an end along with any id-less
 * blocks it leaves at the end.
 */
export function toggleChecked({
  fields,
  selected,
  index,
}: {
  fields: readonly PageItem[];
  selected: ResolvedTarget;
  index: number;
}): CanvasTarget {
  const alone = (at: number) => elementTarget(fields[at]!, at);
  const span = selectedSpan(selected);
  const state = checkStateOf({ fields, selected, index });
  switch (state) {
    case CheckState.Unchecked: {
      if (!span) return alone(index);
      const start = Math.min(span.start, index);
      const end = Math.max(span.end, index + 1);
      const [anchor, focus] =
        index < span.start ? [end - 1, start] : [start, end - 1];
      return rangeOver({ fields, anchor, focus }) ?? alone(index);
    }
    case CheckState.Checked: {
      if (!span || span.end - span.start === 1) {
        return { kind: CanvasTargetKind.Page };
      }
      let start = index === span.start ? span.start + 1 : span.start;
      let end = index === span.start ? span.end : span.end - 1;
      while (start < end - 1 && !fields[start]?.id) start++;
      while (start < end - 1 && !fields[end - 1]?.id) end--;
      return (
        rangeOver({ fields, anchor: start, focus: end - 1 }) ?? alone(start)
      );
    }
    case CheckState.Locked:
      throw new Error(`unchecking ${index} would split the selection`);
    case CheckState.NoId:
      throw new Error(`${index} has no id to select it by`);
    case CheckState.BesideNoId:
      throw new Error(`the selected block has no id to extend from`);
    default:
      throw new Error(`unknown check state: ${state satisfies never}`);
  }
}
