import type { TextBlock } from "@alliance/common/forms/display-blocks";
import { VariableTextField } from "../VariableTextField";
import { BlockPreview } from "./BlockPreview";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

export function EditableTextBlock(props: BaseDisplayBlockProps<TextBlock>) {
  return (
    <DisplayBlockWrapper {...props}>
      {({ block: activeBlock, onUpdate: handleUpdate }) => (
        <div className="space-y-2">
          <VariableTextField
            multiline
            value={activeBlock.text}
            onChange={(text) => handleUpdate({ text })}
            className="w-full text-gray-900 border-none outline-none bg-transparent resize-none whitespace-pre-wrap"
            placeholder="Enter text content"
            style={{ resize: "vertical" }}
          />

          <BlockPreview block={activeBlock} toggleable />
        </div>
      )}
    </DisplayBlockWrapper>
  );
}
