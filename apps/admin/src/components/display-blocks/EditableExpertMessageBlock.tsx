import type { ExpertMessageBlock } from "@alliance/common/forms/display-blocks";
import { UserPicker } from "../UserPicker";
import { VariableTextField } from "../VariableTextField";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

export function EditableExpertMessageBlock(
  props: BaseDisplayBlockProps<ExpertMessageBlock>,
) {
  return (
    <DisplayBlockWrapper {...props}>
      {({ block, onUpdate }) => (
        <div className="space-y-3 bg-zinc-100 px-5 py-4">
          <UserPicker
            selected={block.expert}
            onChange={(expert) => onUpdate({ expert })}
          />
          <VariableTextField
            multiline
            value={block.text}
            onChange={(text) => onUpdate({ text })}
            className="w-full text-gray-900 border-none outline-none !bg-transparent resize-none whitespace-pre-wrap"
            placeholder="What the expert says (markdown)"
            rows={Math.max(2, block.text.split("\n").length)}
            style={{ resize: "vertical" }}
          />
        </div>
      )}
    </DisplayBlockWrapper>
  );
}
