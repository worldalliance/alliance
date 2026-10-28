import {
  BigLinkAction,
  BigLinkColor,
  bigLinkIconOrDefault,
  type BigLinkBlock,
  type BigLinkIcon,
} from "@alliance/common/forms/display-blocks";
import { cn } from "@alliance/shared/styles/util";
import {
  ArrowUpRight,
  Ban,
  Copy,
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

type Option<T> = { value: T; label: string; content: React.ReactNode };

const iconOptions: Option<BigLinkIcon>[] = [
  {
    value: "messages-square",
    label: "Messages",
    content: <MessagesSquare size={16} />,
  },
  { value: "file", label: "File", content: <File size={16} /> },
  { value: "file-text", label: "File Text", content: <FileText size={16} /> },
  {
    value: "file-check",
    label: "File Check",
    content: <FileCheck size={16} />,
  },
  { value: "signature", label: "Signature", content: <Signature size={16} /> },
  { value: "none", label: "No icon", content: <Ban size={16} /> },
];

const colorChoices: Record<BigLinkColor, { label: string; swatch: string }> = {
  [BigLinkColor.Grey]: { label: "Grey", swatch: "bg-grey-0 border-zinc-300" },
  [BigLinkColor.Green]: { label: "Green", swatch: "bg-green/20 border-green" },
};

const colorOptions: Option<BigLinkColor>[] = Object.values(BigLinkColor).map(
  (color) => ({
    value: color,
    label: colorChoices[color].label,
    content: (
      <span
        className={cn(
          "block size-4 rounded-sm border",
          colorChoices[color].swatch,
        )}
      />
    ),
  }),
);

const actionOptions: Option<BigLinkAction>[] = [
  {
    value: BigLinkAction.Open,
    label: "Open the link",
    content: <ArrowUpRight size={16} />,
  },
  {
    value: BigLinkAction.Copy,
    label: "Copy the link",
    content: <Copy size={16} />,
  },
];

function OptionRow<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: Option<T>[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-zinc-500 mr-1">{label}:</span>
      {options.map(({ value, label, content }) => (
        <button
          key={value}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={selected === value}
          onClick={() => onSelect(value)}
          className={cn(
            "p-1.5 rounded border",
            selected === value
              ? "border-blue-500 bg-blue-50 text-blue-700"
              : "border-zinc-200 text-zinc-500 hover:border-zinc-400",
          )}
        >
          {content}
        </button>
      ))}
    </div>
  );
}

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
          <VariableTextField
            multiline
            value={activeBlock.body ?? ""}
            onChange={(body) => handleUpdate({ body: body || undefined })}
            className="w-full text-sm text-gray-900 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Body text (optional)"
            rows={1}
          />
          <LinkSourceFields block={activeBlock} onUpdate={handleUpdate} />
          <label className="flex items-center gap-2 text-xs text-zinc-600">
            <input
              type="checkbox"
              checked={activeBlock.showUrl ?? false}
              onChange={(e) =>
                handleUpdate({ showUrl: e.target.checked || undefined })
              }
            />
            Show the link
          </label>

          <OptionRow
            label="Icon"
            options={iconOptions}
            selected={bigLinkIconOrDefault(activeBlock.icon)}
            onSelect={(icon) => handleUpdate({ icon })}
          />
          <OptionRow
            label="Color"
            options={colorOptions}
            selected={activeBlock.color ?? BigLinkColor.Grey}
            onSelect={(color) => handleUpdate({ color })}
          />
          <OptionRow
            label="On click"
            options={actionOptions}
            selected={activeBlock.action ?? BigLinkAction.Open}
            onSelect={(action) => handleUpdate({ action })}
          />

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
