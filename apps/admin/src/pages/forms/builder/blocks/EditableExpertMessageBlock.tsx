import type { ExpertMessageBlock } from "@alliance/common/forms/display-blocks";
import { InspectorGroup } from "../kit/InspectorGroup";
import { UserPicker } from "../questions/UserPicker";
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
          <UserPicker
            label="Expert"
            selected={block.expert}
            onChange={(expert) => onUpdate({ expert })}
          />
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
