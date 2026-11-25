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
        <div className="space-y-3">
          <div className="space-y-1">
            <span className="block text-xs font-medium text-gray-700">
              Expert
            </span>
            <UserPicker
              placeholder="Search users by name or id"
              ariaLabel="Expert"
              selected={block.expert}
              onChange={(expert) => onUpdate({ expert })}
            />
          </div>
          <label className="block space-y-1">
            <span className="block text-xs font-medium text-gray-700">
              Message (markdown)
            </span>
            <VariableTextField
              multiline
              rows={Math.max(4, block.text.split("\n").length)}
              value={block.text}
              onChange={(text) => onUpdate({ text })}
              className="w-full resize-y rounded border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="What the expert says"
            />
          </label>
        </div>
      )}
    </DisplayBlockWrapper>
  );
}
