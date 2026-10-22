import type {
  BigLinkBlock,
  BigLinkIcon,
} from "@alliance/common/forms/display-blocks";
import { cn } from "@alliance/shared/styles/util";
import {
  File,
  FileCheck,
  FileText,
  MessagesSquare,
  Signature,
} from "lucide-react";
import { useState } from "react";
import { ExternalShareTargetSelect } from "../ExternalShareTargetSelect";
import { VariableTextField } from "../VariableTextField";
import { BlockPreview } from "./BlockPreview";
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
  laterFields,
}: BaseDisplayBlockProps<BigLinkBlock>) {
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
      {({ block: activeBlock, onUpdate: handleUpdate }) => (
        <div className="space-y-2">
          <VariableTextField
            value={activeBlock.text}
            onChange={(text) => handleUpdate({ text })}
            className="w-full text-gray-900 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Link label"
          />
          <LinkSourceFields block={activeBlock} onUpdate={handleUpdate} />

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

          <BlockPreview block={activeBlock} toggleable />
        </div>
      )}
    </DisplayBlockWrapper>
  );
}

function LinkSourceFields({
  block,
  onUpdate,
}: {
  block: BigLinkBlock;
  onUpdate: (updates: Partial<BigLinkBlock>) => void;
}) {
  const [pickingTarget, setPickingTarget] = useState(false);
  const linksToTarget = block.externalTargetId !== undefined || pickingTarget;

  return (
    <>
      <div
        role="radiogroup"
        aria-label="Link to"
        className="inline-flex rounded-md border border-zinc-300 text-xs"
      >
        {[
          { label: "URL", selected: !linksToTarget },
          { label: "Share target", selected: linksToTarget },
        ].map(({ label, selected }) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => {
              if (selected) return;
              setPickingTarget(!linksToTarget);
              if (linksToTarget) onUpdate({ externalTargetId: undefined });
            }}
            className={cn(
              "px-2 py-1 first:rounded-l-md last:rounded-r-md",
              selected
                ? "bg-blue-50 text-blue-700"
                : "text-zinc-500 hover:bg-zinc-50",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {linksToTarget ? (
        <ExternalShareTargetSelect
          label="Share target"
          description="Each signed-in member's link carries their own code; everyone else gets the target's URL."
          value={block.externalTargetId ?? null}
          onChange={(target) =>
            onUpdate({ externalTargetId: target.id, url: target.url })
          }
          onClear={() => onUpdate({ externalTargetId: undefined })}
        />
      ) : (
        <input
          type="text"
          value={block.url}
          onChange={(e) => onUpdate({ url: e.target.value })}
          className="w-full text-zinc-600 text-sm border border-zinc-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="/path or https://..."
        />
      )}
    </>
  );
}
