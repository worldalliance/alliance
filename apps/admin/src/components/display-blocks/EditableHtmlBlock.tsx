import type { HtmlBlock } from "@alliance/common/forms/display-blocks";
import RenderDisplayBlock from "@alliance/sharedweb/forms/RenderDisplayBlock";
import FormTextarea from "../FormTextarea";
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
            className="w-full px-2 py-1 text-sm border border-yellow-300 rounded focus:outline-none focus:ring-1 focus:ring-yellow-500 font-mono bg-yellow-50"
            placeholder="Enter HTML content"
            rows={Math.max(2, activeBlock.html.split("\n").length)}
          />
          {/* Preview */}
          <div className="pt-2 border-t border-gray-200">
            <RenderDisplayBlock block={activeBlock} />
          </div>
        </div>
      )}
    </DisplayBlockWrapper>
  );
}
