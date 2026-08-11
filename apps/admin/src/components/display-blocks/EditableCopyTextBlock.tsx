import type { CopyTextBlock } from "@alliance/common/forms/display-blocks";
import { VariableTextField } from "../VariableTextField";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

export function EditableCopyTextBlock({
  block,
  onUpdate,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  previousFields,
}: BaseDisplayBlockProps<CopyTextBlock>) {
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
          <VariableTextField
            value={activeBlock.title ?? ""}
            onChange={(title) => handleUpdate({ title: title || undefined })}
            className="w-full text-xs text-gray-500 border-none outline-none bg-transparent"
            placeholder="Title (optional)"
          />
          <VariableTextField
            multiline
            value={activeBlock.text}
            onChange={(text) => handleUpdate({ text })}
            className="w-full text-sm text-gray-900 border-none outline-none bg-transparent resize-none overflow-hidden"
            placeholder="Text to copy"
            rows={1}
          />
        </div>
      )}
    </DisplayBlockWrapper>
  );
}
