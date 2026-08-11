import type { LabelBlock } from "@alliance/common/forms/display-blocks";
import { VariableTextField } from "../VariableTextField";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

export function EditableLabelBlock(props: BaseDisplayBlockProps<LabelBlock>) {
  return (
    <DisplayBlockWrapper {...props}>
      {({ block: activeBlock, onUpdate: handleUpdate }) => (
        <VariableTextField
          value={activeBlock.text}
          onChange={(text) => handleUpdate({ text })}
          className="text-sm font-medium text-gray-700 border-none outline-none bg-transparent w-full"
          placeholder="Enter label text"
        />
      )}
    </DisplayBlockWrapper>
  );
}
