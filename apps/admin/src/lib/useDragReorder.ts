import React, { useCallback, useRef, useState } from "react";

export enum DropPosition {
  Before = "before",
  After = "after",
}

const insertionOffset: Record<DropPosition, number> = {
  [DropPosition.Before]: 0,
  [DropPosition.After]: 1,
};

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

  const handleDragOver = (index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedIndex === null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    setDragOverIndex(index);
    setDropPosition(
      e.clientY < midpoint ? DropPosition.Before : DropPosition.After,
    );
  };

  const performDrop = useCallback(
    (index: number, position: DropPosition) => {
      if (draggedIndex === null || draggedIndex === index) {
        handleDragEnd();
        return;
      }
      let insertionIndex = index + insertionOffset[position];
      if (draggedIndex < insertionIndex) insertionIndex -= 1;
      if (draggedIndex === insertionIndex) {
        handleDragEnd();
        return;
      }
      const next = [...items];
      const [moving] = next.splice(draggedIndex, 1);
      next.splice(insertionIndex, 0, moving);
      setItems(next);
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
