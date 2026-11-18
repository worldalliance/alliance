import { useState, type DragEvent } from "react";
import type { ElementDrop, ElementSpan } from "../../lib/moveElements";
import {
  DropPosition,
  insertionOffset,
  leavesInPlace,
  positionIn,
} from "../../lib/useDragReorder";
import type { ListDrag, ListMove } from "./useListDrag";

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

const movesNothing = (from: ElementSpan, to: ElementDrop) =>
  from.pageIndex === to.pageIndex &&
  leavesInPlace({ start: from.start, end: from.end, index: to.index });

export type DropZone = {
  onDragOver: (event: DragEvent) => void;
  active: boolean;
};

const sameTarget = (a: Target | null, b: Target) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * The outline's drags: pages reorder among pages, and elements move to any
 * gap between elements on any page, or onto a page's row to join its end.
 * Grabbing an element inside `selection` drags the whole selection. Passing
 * anywhere but a row cancels the drop.
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
    const to = elementDrop(next);
    const stays =
      dragged?.kind === DragKind.Elements
        ? to !== null && movesNothing(dragged.span, to)
        : dragged?.kind === DragKind.Page &&
          next.kind === TargetKind.Page &&
          leavesInPlace({
            start: dragged.index,
            end: dragged.index + 1,
            index: next.index + insertionOffset[next.position],
          });
    if (stays) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setTarget((current) => (sameTarget(current, next) ? current : next));
  };
  const startDrag = (next: Dragged) => (event: DragEvent) => {
    event.dataTransfer.effectAllowed = "move";
    setDragged(next);
  };

  const acceptDrop = (event: DragEvent) => {
    if (!event.defaultPrevented) setTarget(null);
  };
  const drop = (event: DragEvent) => {
    event.preventDefault();
    if (dragged?.kind === DragKind.Page && target?.kind === TargetKind.Page) {
      onMovePage({
        from: dragged.index,
        dropIndex: target.index,
        position: target.position,
      });
    } else if (dragged?.kind === DragKind.Elements) {
      const to = target && elementDrop(target);
      if (to) onMoveElements(dragged.span, to);
    }
    endDrag();
  };

  const forPage = ({
    index,
    length,
  }: {
    index: number;
    length: number;
  }): ListDrag & { into: DropZone } => {
    const isDragged =
      dragged?.kind === DragKind.Page && dragged.index === index;
    return {
      onDragStart: startDrag({ kind: DragKind.Page, index }),
      onDragEnd: endDrag,
      onDragOver: (event) => {
        if (dragged?.kind === DragKind.Page) {
          aim(event, {
            kind: TargetKind.Page,
            index,
            position: positionIn(event),
          });
        }
      },
      dragging: isDragged,
      dropPosition:
        !isDragged && target?.kind === TargetKind.Page && target.index === index
          ? target.position
          : null,
      into: {
        onDragOver: (event) => {
          if (dragged?.kind === DragKind.Elements) {
            aim(event, { kind: TargetKind.IntoPage, pageIndex: index, length });
          }
        },
        active:
          target?.kind === TargetKind.IntoPage && target.pageIndex === index,
      },
    };
  };

  const forElement = ({
    pageIndex,
    index,
  }: {
    pageIndex: number;
    index: number;
  }): ListDrag => {
    const span =
      selection?.pageIndex === pageIndex &&
      index >= selection.start &&
      index < selection.end
        ? selection
        : { pageIndex, start: index, end: index + 1 };
    const isDragged =
      dragged?.kind === DragKind.Elements &&
      dragged.span.pageIndex === pageIndex &&
      index >= dragged.span.start &&
      index < dragged.span.end;
    return {
      onDragStart: startDrag({ kind: DragKind.Elements, span }),
      onDragEnd: endDrag,
      onDragOver: (event) => {
        if (dragged?.kind !== DragKind.Elements) return;
        aim(event, {
          kind: TargetKind.Element,
          pageIndex,
          index,
          position: positionIn(event),
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
    };
  };

  /** A group's header row, which takes elements dropped before the group. */
  const forGroup = ({
    pageIndex,
    start,
    end,
  }: {
    pageIndex: number;
    start: number;
    end: number;
  }): DropZone & { dragging: boolean } => ({
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

  return { acceptDrop, drop, forPage, forElement, forGroup };
}
