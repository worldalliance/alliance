import type { TextBlock } from "@alliance/common/forms/display-blocks";
import { InspectorGroup } from "../kit/InspectorGroup";
import { BlockPreview } from "./BlockPreview";
import { BlockTextField } from "./BlockTextField";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import { ExpandableBlockText } from "./ExpandableBlockText";
import type { BaseDisplayBlockProps } from "./types";

export function EditableTextBlock(props: BaseDisplayBlockProps<TextBlock>) {
  return (
    <DisplayBlockWrapper {...props}>
      {({ block, onUpdate }) => (
        <InspectorGroup>
          <ExpandableBlockText title="Edit text" block={block}>
            {(rows) => (
              <BlockTextField
                label="Text"
                multiline
                rows={rows}
                value={block.text}
                onChange={(text) => onUpdate({ text })}
                placeholder="Enter text content"
              />
            )}
          </ExpandableBlockText>
          <BlockPreview block={block} toggleable />
        </InspectorGroup>
      )}
    </DisplayBlockWrapper>
  );
}
