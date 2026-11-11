import React, { useCallback, useRef, useState } from "react";

export enum DropPosition {
  Before = "before",
  After = "after",
}

const insertionOffset: Record<DropPosition, number> = {
  [DropPosition.Before]: 0,
  [DropPosition.After]: 1,
};

/** Whether the gap before `index` touches the items `start` up to `end`, so moving them there changes nothing. */
export const leavesInPlace = ({
  start,
  end,
  index,
}: {
  start: number;
  end: number;
  index: number;
}) => index >= start && index <= end;

/**
 * Moves the items `start` up to, not including, `end` to the gap before
 * `index`, counted before the move. Null when the move leaves them where they
 * were.
 */
export function moveSpan<T>({
  items,
  start,
  end,
  index,
}: {
  items: readonly T[];
  start: number;
  end: number;
  index: number;
}): { items: T[]; insertionIndex: number } | null {
  if (leavesInPlace({ start, end, index })) return null;
  const rest = [...items.slice(0, start), ...items.slice(end)];
  const insertionIndex = index > end ? index - (end - start) : index;
  return {
    items: [
      ...rest.slice(0, insertionIndex),
      ...items.slice(start, end),
      ...rest.slice(insertionIndex),
    ],
    insertionIndex,
  };
}

/**
 * Moves the item at `draggedIndex` to the `position` side of `dropIndex`. Null
 * when the move leaves the item where it was.
 */
export function moveItem<T>(params: {
  items: T[];
  draggedIndex: number;
  dropIndex: number;
  position: DropPosition;
}): { items: T[]; insertionIndex: number } | null {
  const { items, draggedIndex, dropIndex, position } = params;
  return moveSpan({
    items,
    start: draggedIndex,
    end: draggedIndex + 1,
    index: dropIndex + insertionOffset[position],
  });
}

export function useDragReorder<T>(items: T[], setItems: (items: T[]) => void) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dropPosition, setDropPosition] = useState<DropPosition | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  /** Compute drop index and position from clientY when dropping on list (e.g. in gap between items). */
  const getDropTargetFromClientY = useCallback(
    (clientY: number): { index: number; position: DropPosition } | null => {
      const ul = listRef.current;
      if (!ul) return null;
      const lis = Array.from(ul.querySelectorAll<HTMLElement>(":scope > li"));
      if (lis.length === 0) return null;
      const rects = lis.map((el) => el.getBoundingClientRect());
      const firstTop = rects[0].top;
      const lastBottom = rects[rects.length - 1].bottom;
      if (clientY <= firstTop)
        return { index: 0, position: DropPosition.Before };
      if (clientY >= lastBottom)
        return { index: rects.length - 1, position: DropPosition.After };
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i];
        if (clientY >= r.top && clientY <= r.bottom) {
          const midpoint = r.top + r.height / 2;
          return {
            index: i,
            position:
              clientY < midpoint ? DropPosition.Before : DropPosition.After,
          };
        }
        if (
          i < rects.length - 1 &&
          clientY > r.bottom &&
          clientY < rects[i + 1].top
        ) {
          return { index: i, position: DropPosition.After };
        }
      }
      return null;
    },
    [],
  );

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    setDropPosition(null);
  };

  const handleDragOver =
    (index: number, position?: DropPosition) => (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (draggedIndex === null) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      setDragOverIndex(index);
      setDropPosition(
        position ??
          (e.clientY < midpoint ? DropPosition.Before : DropPosition.After),
      );
    };

  const performDrop = useCallback(
    (index: number, position: DropPosition) => {
      const moved =
        draggedIndex !== null &&
        moveItem({ items, draggedIndex, dropIndex: index, position });
      if (moved) setItems(moved.items);
      handleDragEnd();
    },
    [draggedIndex, items, setItems],
  );

  const handleDrop = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedIndex === null || dropPosition === null) {
      handleDragEnd();
      return;
    }
    performDrop(index, dropPosition);
  };

  const handleListDragOver = useCallback(
    (e: React.DragEvent<HTMLUListElement>) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    },
    [],
  );

  const handleListDrop = useCallback(
    (e: React.DragEvent<HTMLUListElement>) => {
      e.preventDefault();
      if (draggedIndex === null) {
        handleDragEnd();
        return;
      }
      const target = getDropTargetFromClientY(e.clientY);
      if (target) performDrop(target.index, target.position);
      else handleDragEnd();
    },
    [draggedIndex, getDropTargetFromClientY, performDrop],
  );

  return {
    listRef,
    draggedIndex,
    dragOverIndex,
    dropPosition,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDrop,
    handleListDragOver,
    handleListDrop,
  };
}
