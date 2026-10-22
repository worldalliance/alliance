import {
  CopyTextFormat,
  type CopyTextBlock,
} from "@alliance/common/forms/display-blocks";
import { copyTextFormat } from "@alliance/shared/forms/copyText";
import { cn } from "@alliance/shared/styles/util";
import { Type } from "lucide-react";
import { VariableTextField } from "../VariableTextField";
import { BlockPreview } from "./BlockPreview";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

export function EditableCopyTextBlock({
  block,
  onUpdate,
  updateCurrent,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  previousFields,
  laterFields,
}: BaseDisplayBlockProps<CopyTextBlock>) {
  return (
    <DisplayBlockWrapper
      onRemove={onRemove}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      isDragging={isDragging}
      block={block}
      onUpdate={onUpdate}
      updateCurrent={updateCurrent}
      previousFields={previousFields}
      laterFields={laterFields}
    >
      {({ block: activeBlock, onUpdate: handleUpdate, updateBlockWide }) => {
        const rich = copyTextFormat(activeBlock) === CopyTextFormat.Markdown;
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <VariableTextField
                value={activeBlock.title ?? ""}
                onChange={(title) =>
                  handleUpdate({ title: title || undefined })
                }
                className="w-full text-xs text-gray-500 border-none outline-none bg-transparent"
                containerClassName="flex-1"
                placeholder="Title (optional)"
              />
              <RichTextToggle
                rich={rich}
                onChange={(rich) =>
                  updateBlockWide({
                    format: rich ? CopyTextFormat.Markdown : undefined,
                  })
                }
              />
            </div>
            <VariableTextField
              multiline
              value={activeBlock.text}
              onChange={(text) => handleUpdate({ text })}
              className="w-full text-sm text-gray-900 border-none outline-none bg-transparent resize-none overflow-hidden"
              placeholder={rich ? "Text to copy (markdown)" : "Text to copy"}
              rows={1}
            />
            {rich && <BlockPreview block={activeBlock} toggleable />}
          </div>
        );
      }}
    </DisplayBlockWrapper>
  );
}

function RichTextToggle({
  rich,
  onChange,
}: {
  rich: boolean;
  onChange: (rich: boolean) => void;
}) {
  const label = rich
    ? "Rich text: markdown, copied with formatting"
    : "Plain text: copied as typed";
  return (
    <button
      type="button"
      aria-label="Rich text"
      aria-pressed={rich}
      title={label}
      onClick={() => onChange(!rich)}
      className={cn(
        "p-1 rounded border",
        rich
          ? "border-blue-500 bg-blue-50 text-blue-700"
          : "border-zinc-200 text-zinc-500 hover:border-zinc-400",
      )}
    >
      <Type size={14} />
    </button>
  );
}
