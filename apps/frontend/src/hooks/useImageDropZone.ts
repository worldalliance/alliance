import { type DragEvent, useRef, useState } from "react";

function isDraggingImage(e: DragEvent) {
  const items = e.dataTransfer?.items;
  if (!items) return false;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (item.kind === "file" && item.type.startsWith("image/")) {
      return true;
    }

    if (item.type.startsWith("image/")) {
      return true;
    }
  }

  return false;
}

export function useImageDropZone(onFiles: (files: File[]) => unknown) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const onDragEnterCapture = (e: DragEvent) => {
    if (!isDraggingImage(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    setIsDragging(true);
  };

  const onDragOverCapture = (e: DragEvent) => {
    if (!isDraggingImage(e)) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const onDragLeaveCapture = (e: DragEvent) => {
    if (!isDraggingImage(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      setIsDragging(false);
    }
  };

  const onDropCapture = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);
    onFiles(Array.from(e.dataTransfer?.files ?? []));
  };

  return {
    isDragging,
    dropZoneProps: {
      onDragEnterCapture,
      onDragOverCapture,
      onDragLeaveCapture,
      onDropCapture,
    },
  };
}
