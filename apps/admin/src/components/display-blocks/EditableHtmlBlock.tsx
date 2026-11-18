import type { HtmlBlock } from "@alliance/common/forms/display-blocks";
import FormTextarea from "../FormTextarea";
import { BlockPreview } from "./BlockPreview";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

export function EditableHtmlBlock(props: BaseDisplayBlockProps<HtmlBlock>) {
  return (
    <DisplayBlockWrapper {...props}>
      {({ block: activeBlock, onUpdate: handleUpdate }) => (
        <div className="space-y-2">
          {/* Inline HTML editor */}
          <FormTextarea
            value={activeBlock.html}
            onChange={(e) => handleUpdate({ html: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-amber-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-amber-500 font-mono bg-amber-50"
            placeholder="Enter HTML content"
            rows={Math.max(2, activeBlock.html.split("\n").length)}
          />
          <BlockPreview block={activeBlock} />
        </div>
      )}
    </DisplayBlockWrapper>
  );
}
