import type { LabelBlock } from "@alliance/common/forms/display-blocks";
import { InspectorGroup } from "../../pages/forms/builder/kit/InspectorGroup";
import { BlockTextField } from "./BlockTextField";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

export function EditableLabelBlock(props: BaseDisplayBlockProps<LabelBlock>) {
  return (
    <DisplayBlockWrapper {...props}>
      {({ block, onUpdate }) => (
        <InspectorGroup>
          <BlockTextField
            label="Text"
            value={block.text}
            onChange={(text) => onUpdate({ text })}
            placeholder="Enter label text"
          />
        </InspectorGroup>
      )}
    </DisplayBlockWrapper>
  );
}
