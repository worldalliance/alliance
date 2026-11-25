import type { ExpertMessageBlock } from "@alliance/common/forms/display-blocks";
import { InspectorGroup } from "../../pages/forms/builder/kit/InspectorGroup";
import { UserPicker } from "../UserPicker";
import { BlockTextField } from "./BlockTextField";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import { ExpandableBlockText } from "./ExpandableBlockText";
import type { BaseDisplayBlockProps } from "./types";

export function EditableExpertMessageBlock(
  props: BaseDisplayBlockProps<ExpertMessageBlock>,
) {
  return (
    <DisplayBlockWrapper {...props}>
      {({ block, onUpdate }) => (
        <InspectorGroup>
          <div className="flex flex-col gap-1.5">
            <span aria-hidden="true" className="font-medium">
              Expert
            </span>
            <UserPicker
              placeholder="Search users by name or id"
              ariaLabel="Expert"
              selected={block.expert}
              onChange={(expert) => onUpdate({ expert })}
            />
          </div>
          <ExpandableBlockText title="Edit expert message" block={block}>
            {(rows) => (
              <BlockTextField
                label="Message"
                help="Written in markdown."
                multiline
                rows={rows}
                value={block.text}
                onChange={(text) => onUpdate({ text })}
                placeholder="What the expert says"
              />
            )}
          </ExpandableBlockText>
        </InspectorGroup>
      )}
    </DisplayBlockWrapper>
  );
}
