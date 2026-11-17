import type { DividerBlock } from "@alliance/common/forms/display-blocks";
import { BlockPreview } from "./BlockPreview";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

export function EditableDividerBlock(
  props: BaseDisplayBlockProps<DividerBlock>,
) {
  return (
    <DisplayBlockWrapper {...props}>
      {({ block: activeBlock, onUpdate: handleUpdate }) => (
        <div className="space-y-2">
          {/* Compact thickness selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">Thickness:</span>
            <select
              value={activeBlock.thickness || "thin"}
              onChange={(e) =>
                handleUpdate({
                  thickness: e.target.value as
                    | "hairline"
                    | "thin"
                    | "medium"
                    | "thick",
                })
              }
              className="text-xs border border-zinc-300 rounded-md px-1 py-0.5 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="hairline">Hairline</option>
              <option value="thin">Thin</option>
              <option value="medium">Medium</option>
              <option value="thick">Thick</option>
            </select>
          </div>

          <BlockPreview block={activeBlock} />
        </div>
      )}
    </DisplayBlockWrapper>
  );
}
