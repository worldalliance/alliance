import type { SpacerBlock } from "@alliance/common/forms/display-blocks";
import { BlockPreview } from "./BlockPreview";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

export function EditableSpacerBlock(props: BaseDisplayBlockProps<SpacerBlock>) {
  return (
    <DisplayBlockWrapper {...props}>
      {({ block: activeBlock, onUpdate: handleUpdate }) => (
        <div className="space-y-2">
          {/* Compact size selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Size:</span>
            <select
              value={activeBlock.size || "md"}
              onChange={(e) =>
                handleUpdate({
                  size: e.target.value as "xs" | "sm" | "md" | "lg" | "xl",
                })
              }
              className="text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="xs">XS</option>
              <option value="sm">SM</option>
              <option value="md">MD</option>
              <option value="lg">LG</option>
              <option value="xl">XL</option>
            </select>
          </div>
          <BlockPreview block={activeBlock} />
        </div>
      )}
    </DisplayBlockWrapper>
  );
}
