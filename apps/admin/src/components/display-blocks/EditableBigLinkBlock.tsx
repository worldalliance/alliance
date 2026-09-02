import type {
  BigLinkBlock,
  BigLinkIcon,
} from "@alliance/common/forms/display-blocks";
import { cn } from "@alliance/shared/styles/util";
import RenderDisplayBlock from "@alliance/sharedweb/forms/RenderDisplayBlock";
import {
  File,
  FileCheck,
  FileText,
  MessagesSquare,
  Signature,
} from "lucide-react";
import { useState } from "react";
import { VariableTextField } from "../VariableTextField";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

const iconOptions: {
  value: BigLinkIcon;
  label: string;
  Icon: React.FC<{ size?: number }>;
}[] = [
  { value: "messages-square", label: "Messages", Icon: MessagesSquare },
  { value: "file", label: "File", Icon: File },
  { value: "file-text", label: "File Text", Icon: FileText },
  { value: "file-check", label: "File Check", Icon: FileCheck },
  { value: "signature", label: "Signature", Icon: Signature },
];

export function EditableBigLinkBlock({
  block,
  onUpdate,
  updateCurrent,
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
      updateCurrent={updateCurrent}
      previousFields={previousFields}
    >
      {({ block: activeBlock, onUpdate: handleUpdate }) => (
        <div className="space-y-2">
          <VariableTextField
            value={activeBlock.text}
            onChange={(text) => handleUpdate({ text })}
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

          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-500 mr-1">Icon:</span>
            {iconOptions.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                title={label}
                onClick={() => handleUpdate({ icon: value })}
                className={cn(
                  "p-1.5 rounded border",
                  (activeBlock.icon || "messages-square") === value
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-zinc-200 text-zinc-500 hover:border-zinc-400",
                )}
              >
                <Icon size={16} />
              </button>
            ))}
          </div>

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
