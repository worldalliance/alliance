import { useState, type DragEvent } from "react";
import type { ElementDrop, ElementSpan } from "../../../../lib/moveElements";
import {
  DropPosition,
  insertionOffset,
  itemMove,
  leavesInPlace,
  positionIn,
  type ListMove,
} from "../../../../lib/useDragReorder";
import type { ListDrag } from "../canvas/useListDrag";

enum DragKind {
  Page = "page",
  Elements = "elements",
}

type Dragged =
  | { kind: DragKind.Page; index: number }
  | { kind: DragKind.Elements; span: ElementSpan };

enum TargetKind {
  Page = "page",
  Element = "element",
  IntoPage = "intoPage",
  BeforeGroup = "beforeGroup",
}

type Target =
  | { kind: TargetKind.Page; index: number; position: DropPosition }
  | {
      kind: TargetKind.Element;
      pageIndex: number;
      index: number;
      position: DropPosition;
    }
  | { kind: TargetKind.IntoPage; pageIndex: number; length: number }
  | { kind: TargetKind.BeforeGroup; pageIndex: number; index: number };

function elementDrop(target: Target): ElementDrop | null {
  switch (target.kind) {
    case TargetKind.Page:
      return null;
    case TargetKind.Element:
      return {
        pageIndex: target.pageIndex,
        index: target.index + insertionOffset[target.position],
      };
    case TargetKind.IntoPage:
      return { pageIndex: target.pageIndex, index: target.length };
    case TargetKind.BeforeGroup:
      return { pageIndex: target.pageIndex, index: target.index };
    default:
      throw new Error(
        `unknown target: ${JSON.stringify(target satisfies never)}`,
      );
  }
}

function movesNothing(dragged: Dragged, target: Target): boolean {
  switch (dragged.kind) {
    case DragKind.Page:
      return (
        target.kind === TargetKind.Page &&
        leavesInPlace(
          itemMove({
            from: dragged.index,
            dropIndex: target.index,
            position: target.position,
          }),
        )
      );
    case DragKind.Elements: {
      const { span } = dragged;
      const to = elementDrop(target);
      return (
        to !== null &&
        span.pageIndex === to.pageIndex &&
        leavesInPlace({ start: span.start, end: span.end, index: to.index })
      );
    }
    default:
      throw new Error(
        `unknown drag: ${JSON.stringify(dragged satisfies never)}`,
      );
  }
}

type DragOver = (event: DragEvent) => void;

type DropZone = { onDragOver: DragOver; active: boolean };

/**
 * An outline entry's drag. `overRow` takes dragover on the entry's own row,
 * and `overEntry` anywhere in the entry, its open contents included.
 */
export type EntryDrag = Omit<ListDrag, "onDragOver"> & {
  overEntry?: DragOver;
  overRow: DragOver;
  /** The row takes the drop whole, so it shows a ring for a drop line. */
  ringed: boolean;
};

const sameTarget = (a: Target | null, b: Target) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * The outline's drags: pages reorder among pages, and elements move to any
 * gap between elements on any page, or onto a page's row to join its end.
 * Grabbing an element inside `selection` drags the whole selection. An element
 * drag passing anywhere but a row cancels its drop; a page drag keeps its drop
 * anywhere on a page's entry.
 */
export function useOutlineDrag({
  selection,
  onMovePage,
  onMoveElements,
}: {
  selection: ElementSpan | null;
  onMovePage: (move: ListMove) => void;
  onMoveElements: (from: ElementSpan, to: ElementDrop) => void;
}) {
  const [dragged, setDragged] = useState<Dragged | null>(null);
  const [target, setTarget] = useState<Target | null>(null);

  const endDrag = () => {
    setDragged(null);
    setTarget(null);
  };
  const aim = (event: DragEvent, next: Target) => {
    if (dragged && movesNothing(dragged, next)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setTarget((current) => (sameTarget(current, next) ? current : next));
  };
  const startDrag = (next: Dragged) => (event: DragEvent) => {
    event.dataTransfer.effectAllowed = "move";
    setDragged(next);
  };

  const clearOffRows = (event: DragEvent) => {
    if (!event.defaultPrevented) setTarget(null);
  };
  const drop = (event: DragEvent) => {
    event.preventDefault();
    if (dragged && target) land(dragged, target);
    endDrag();
  };
  const land = (from: Dragged, to: Target) => {
    switch (from.kind) {
      case DragKind.Page:
        if (to.kind === TargetKind.Page) {
          onMovePage({
            from: from.index,
            dropIndex: to.index,
            position: to.position,
          });
        }
        return;
      case DragKind.Elements: {
        const gap = elementDrop(to);
        if (gap) onMoveElements(from.span, gap);
        return;
      }
      default:
        throw new Error(
          `unknown drag: ${JSON.stringify(from satisfies never)}`,
        );
    }
  };

  /** `span`, or the selection when it holds `span`, which then drags whole. */
  const grabbed = (span: ElementSpan) =>
    selection?.pageIndex === span.pageIndex &&
    span.start >= selection.start &&
    span.end <= selection.end
      ? selection
      : span;

  const forPage = ({
    index,
    length,
  }: {
    index: number;
    length: number;
  }): EntryDrag => {
    const isDragged =
      dragged?.kind === DragKind.Page && dragged.index === index;
    return {
      onDragStart: startDrag({ kind: DragKind.Page, index }),
      onDragEnd: endDrag,
      overEntry: (event) => {
        if (dragged?.kind === DragKind.Page) {
          aim(event, {
            kind: TargetKind.Page,
            index,
            position: positionIn(
              event.clientY,
              event.currentTarget.getBoundingClientRect(),
            ),
          });
        }
      },
      dragging: isDragged,
      dropPosition:
        !isDragged && target?.kind === TargetKind.Page && target.index === index
          ? target.position
          : null,
      overRow: (event) => {
        if (dragged?.kind === DragKind.Elements) {
          aim(event, { kind: TargetKind.IntoPage, pageIndex: index, length });
        }
      },
      ringed:
        target?.kind === TargetKind.IntoPage && target.pageIndex === index,
    };
  };

  const forElement = ({
    pageIndex,
    index,
    beforeOnly,
  }: {
    pageIndex: number;
    index: number;
    /**
     * For an open entry: a line after it would sit below its contents,
     * perhaps off screen.
     */
    beforeOnly: boolean;
  }): EntryDrag => {
    const span = grabbed({ pageIndex, start: index, end: index + 1 });
    const isDragged =
      dragged?.kind === DragKind.Elements &&
      dragged.span.pageIndex === pageIndex &&
      index >= dragged.span.start &&
      index < dragged.span.end;
    return {
      onDragStart: startDrag({ kind: DragKind.Elements, span }),
      onDragEnd: endDrag,
      overRow: (event) => {
        if (dragged?.kind !== DragKind.Elements) return;
        aim(event, {
          kind: TargetKind.Element,
          pageIndex,
          index,
          position: beforeOnly
            ? DropPosition.Before
            : positionIn(
                event.clientY,
                event.currentTarget.getBoundingClientRect(),
              ),
        });
      },
      dragging: isDragged,
      dropPosition:
        !isDragged &&
        target?.kind === TargetKind.Element &&
        target.pageIndex === pageIndex &&
        target.index === index
          ? target.position
          : null,
      ringed: false,
    };
  };

  /** A group's header row, which drags the group and takes elements dropped before it. */
  const forGroup = ({
    pageIndex,
    start,
    end,
  }: {
    pageIndex: number;
    start: number;
    end: number;
  }): DropZone & Pick<ListDrag, "onDragStart" | "onDragEnd" | "dragging"> => ({
    onDragStart: startDrag({
      kind: DragKind.Elements,
      span: grabbed({ pageIndex, start, end }),
    }),
    onDragEnd: endDrag,
    onDragOver: (event) => {
      if (dragged?.kind === DragKind.Elements) {
        aim(event, { kind: TargetKind.BeforeGroup, pageIndex, index: start });
      }
    },
    dragging:
      dragged?.kind === DragKind.Elements &&
      dragged.span.pageIndex === pageIndex &&
      dragged.span.start <= start &&
      dragged.span.end >= end,
    active:
      target?.kind === TargetKind.BeforeGroup &&
      target.pageIndex === pageIndex &&
      target.index === start,
  });

  return { clearOffRows, drop, forPage, forElement, forGroup };
}
