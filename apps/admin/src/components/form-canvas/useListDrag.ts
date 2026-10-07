import { useState, type DragEvent } from "react";
import { DropPosition } from "../../lib/useDragReorder";

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

type ListItem<L> = { list: L; index: number };

/**
 * Drag-to-reorder across items in one or more lists, each move staying
 * within its list. The drop line sits in the gap between items, so the
 * container accepts the drop and commits the last target an item reported.
 */
export function useListDrag<L>(onMove: (list: L, move: ListMove) => void) {
  const [dragged, setDragged] = useState<ListItem<L> | null>(null);
  const [dropTarget, setDropTarget] = useState<
    (ListItem<L> & { position: DropPosition }) | null
  >(null);

  const endDrag = () => {
    setDragged(null);
    setDropTarget(null);
  };

  const acceptDrop = (event: DragEvent) => {
    if (dragged !== null) event.preventDefault();
  };
  const drop = (event: DragEvent) => {
    event.preventDefault();
    if (dragged !== null && dropTarget !== null) {
      onMove(dragged.list, {
        from: dragged.index,
        dropIndex: dropTarget.index,
        position: dropTarget.position,
      });
    }
    endDrag();
  };

  const dragFor = (list: L, index: number): ListDrag => {
    const isDragged = dragged?.list === list && dragged.index === index;
    return {
      onDragStart: (event: DragEvent) => {
        event.dataTransfer.effectAllowed = "move";
        setDragged({ list, index });
      },
      onDragEnd: endDrag,
      onDragOver: (event: DragEvent) => {
        if (dragged?.list !== list) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const rect = event.currentTarget.getBoundingClientRect();
        const position =
          event.clientY < rect.top + rect.height / 2
            ? DropPosition.Before
            : DropPosition.After;
        if (
          dropTarget?.list !== list ||
          dropTarget.index !== index ||
          dropTarget.position !== position
        ) {
          setDropTarget({ list, index, position });
        }
      },
      dragging: isDragged,
      dropPosition:
        dragged?.list === list &&
        !isDragged &&
        dropTarget?.list === list &&
        dropTarget.index === index
          ? dropTarget.position
          : null,
    };
  };

  return { acceptDrop, drop, dragFor };
}
