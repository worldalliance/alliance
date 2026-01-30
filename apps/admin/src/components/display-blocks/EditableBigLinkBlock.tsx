import type { BigLinkBlock } from "@alliance/shared/forms/display-blocks";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";
import RenderDisplayBlock from "@alliance/sharedweb/forms/RenderDisplayBlock";
import { useState } from "react";

export function EditableBigLinkBlock({
  block,
  onUpdate,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  previousFields,
}: BaseDisplayBlockProps<BigLinkBlock>) {
  const [showPreview, setShowPreview] = useState(false);

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
        <div className="space-y-2">
          <input
            type="text"
            value={activeBlock.text}
            onChange={(e) => handleUpdate({ text: e.target.value })}
            className="w-full text-gray-900 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Link label"
          />
          <input
            type="text"
            value={activeBlock.url}
            onChange={(e) => handleUpdate({ url: e.target.value })}
            className="w-full text-zinc-600 text-sm border border-zinc-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="/path or https://..."
          />

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowPreview((prev) => !prev)}
              className="text-xs font-medium text-green hover:text-emerald-700"
            >
              {showPreview ? "Hide preview" : "Show preview"}
            </button>
          </div>

          {showPreview && (
            <div className="border border-gray-200 rounded-md p-3 bg-white">
              <RenderDisplayBlock
                block={{
                  ...activeBlock,
                  kind: "biglink",
                }}
              />
            </div>
          )}
        </div>
      )}
    </DisplayBlockWrapper>
  );
}
