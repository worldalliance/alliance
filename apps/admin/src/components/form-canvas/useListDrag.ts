import { useState, type DragEvent } from "react";
import {
  DropPosition,
  insertionOffset,
  leavesInPlace,
  positionIn,
} from "../../lib/useDragReorder";

export type ListMove = {
  from: number;
  dropIndex: number;
  position: DropPosition;
};

export type ListDrag = {
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent) => void;
  dragging: boolean;
  dropPosition: DropPosition | null;
};

/**
 * Drag-to-reorder within one list. The drop line sits in the gap between
 * items, so the container accepts the drop and commits the last target an
 * item reported.
 */
export function useListDrag(onMove: (move: ListMove) => void) {
  const [dragged, setDragged] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    index: number;
    position: DropPosition;
  } | null>(null);

  const endDrag = () => {
    setDragged(null);
    setDropTarget(null);
  };

  const acceptDrop = (event: DragEvent) => {
    if (dragged !== null && dropTarget !== null) event.preventDefault();
  };
  const drop = (event: DragEvent) => {
    event.preventDefault();
    if (dragged !== null && dropTarget !== null) {
      onMove({
        from: dragged,
        dropIndex: dropTarget.index,
        position: dropTarget.position,
      });
    }
    endDrag();
  };

  const dragFor = (index: number): ListDrag => ({
    onDragStart: (event: DragEvent) => {
      event.dataTransfer.effectAllowed = "move";
      setDragged(index);
    },
    onDragEnd: endDrag,
    onDragOver: (event: DragEvent) => {
      if (dragged === null) return;
      const position = positionIn(event);
      if (
        leavesInPlace({
          start: dragged,
          end: dragged + 1,
          index: index + insertionOffset[position],
        })
      ) {
        event.stopPropagation();
        setDropTarget(null);
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropTarget((current) =>
        current?.index === index && current.position === position
          ? current
          : { index, position },
      );
    },
    dragging: dragged === index,
    dropPosition:
      dragged !== null && dropTarget?.index === index
        ? dropTarget.position
        : null,
  });

  return { acceptDrop, drop, dragFor };
}
