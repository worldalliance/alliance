import type React from "react";

export type ShareableInsertable = {
  id: string;
  label: string;
  token: string;
  kind: string;
  pageTitle: string;
};

export function InsertableTokenButton({
  item,
  dataKey,
  onInsert,
}: {
  item: ShareableInsertable;
  dataKey: string;
  onInsert: () => void;
}) {
  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData(dataKey, item.token);
        event.dataTransfer.setData("text/plain", item.token);
      }}
      onClick={onInsert}
      title={`${item.token} · ${item.pageTitle}`}
      className="inline-flex max-w-full cursor-grab items-center gap-1.5 rounded-full border border-line-control bg-surface px-2.5 py-1 text-left transition-colors duration-fast hover:bg-surface-2 focus-ring"
    >
      <span className="truncate font-medium">{item.label}</span>
      {item.label !== item.token && (
        <span className="truncate font-mono text-xs text-fg-muted">
          {item.token}
        </span>
      )}
    </button>
  );
}

export function findDroppedInsertable<T extends ShareableInsertable>(params: {
  event: React.DragEvent;
  dataKey: string;
  insertables: readonly T[];
}): T | undefined {
  const droppedToken = params.event.dataTransfer.getData(params.dataKey);
  if (!droppedToken) {
    return undefined;
  }
  return params.insertables.find(
    (candidate) => candidate.token === droppedToken,
  );
}
