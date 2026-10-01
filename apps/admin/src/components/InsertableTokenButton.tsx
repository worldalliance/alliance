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
      className="w-full rounded-md border border-gray-200 bg-white px-3 py-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
    >
      <div className="font-medium text-gray-900">{item.label}</div>
      <div className="mt-1 text-xs text-gray-500">
        {item.token} · {item.pageTitle}
      </div>
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
