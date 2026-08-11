import type { UserLocationBlock } from "@alliance/common/forms/display-blocks";
import { VariableTextField } from "../VariableTextField";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

export function EditableUserLocationBlock({
  block,
  onUpdate,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  previousFields,
}: BaseDisplayBlockProps<UserLocationBlock>) {
  return (
    <DisplayBlockWrapper
      onRemove={onRemove}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      isDragging={isDragging}
      block={block}
      onUpdate={onUpdate}
      previousFields={previousFields}
    >
      {({ block: activeBlock, onUpdate: handleUpdate }) => (
        <div className="space-y-3">
          <div className="font-medium">User Location Block</div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <VariableTextField
              value={activeBlock.title ?? ""}
              onChange={(title) => handleUpdate({ title: title || undefined })}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Your location"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Empty state text
            </label>
            <VariableTextField
              value={activeBlock.emptyText ?? ""}
              onChange={(emptyText) =>
                handleUpdate({ emptyText: emptyText || undefined })
              }
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="No location set"
            />
          </div>
          <div className="rounded-md border border-gray-200 bg-zinc-50 px-3 py-2">
            {activeBlock.title ? (
              <p className="text-xs text-zinc-500">{activeBlock.title}</p>
            ) : null}
            <p className="text-sm text-zinc-900">
              San Francisco, California, United States
            </p>
          </div>
        </div>
      )}
    </DisplayBlockWrapper>
  );
}
