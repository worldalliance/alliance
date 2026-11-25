import {
  CopyTextFormat,
  type CopyTextBlock,
} from "@alliance/common/forms/display-blocks";
import { copyTextFormat } from "@alliance/shared/forms/copyText";
import { InspectorGroup } from "../../pages/forms/builder/kit/InspectorGroup";
import { CheckboxField } from "../../ui/templates/Form";
import { BlockPreview } from "./BlockPreview";
import { BlockTextField } from "./BlockTextField";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import { ExpandableBlockText } from "./ExpandableBlockText";
import type { BaseDisplayBlockProps } from "./types";

export function EditableCopyTextBlock(
  props: BaseDisplayBlockProps<CopyTextBlock>,
) {
  return (
    <DisplayBlockWrapper {...props}>
      {({ block, onUpdate, updateBlockWide }) => {
        const rich = copyTextFormat(block) === CopyTextFormat.Markdown;
        return (
          <InspectorGroup>
            <BlockTextField
              label="Title"
              mark="optional"
              value={block.title ?? ""}
              onChange={(title) => onUpdate({ title: title || undefined })}
            />
            <CheckboxField
              label="Rich text (markdown)"
              help="Copied with its formatting. Applies to every member's content."
              checked={rich}
              onChange={(event) =>
                updateBlockWide({
                  format: event.target.checked
                    ? CopyTextFormat.Markdown
                    : undefined,
                })
              }
            />
            <ExpandableBlockText
              title="Edit text to copy"
              block={rich ? block : undefined}
            >
              {(rows) => (
                <BlockTextField
                  label="Text to copy"
                  multiline
                  rows={rows}
                  value={block.text}
                  onChange={(text) => onUpdate({ text })}
                />
              )}
            </ExpandableBlockText>
            {rich && <BlockPreview block={block} toggleable />}
          </InspectorGroup>
        );
      }}
    </DisplayBlockWrapper>
  );
}
