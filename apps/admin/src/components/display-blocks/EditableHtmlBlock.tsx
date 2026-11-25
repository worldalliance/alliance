import type { HtmlBlock } from "@alliance/common/forms/display-blocks";
import { InspectorGroup } from "../../pages/forms/builder/kit/InspectorGroup";
import { Textarea } from "../../ui/Textarea";
import { Field } from "../../ui/templates/Form";
import { BlockPreview } from "./BlockPreview";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import { ExpandableBlockText } from "./ExpandableBlockText";
import type { BaseDisplayBlockProps } from "./types";

export function EditableHtmlBlock(props: BaseDisplayBlockProps<HtmlBlock>) {
  return (
    <DisplayBlockWrapper {...props}>
      {({ block, onUpdate }) => (
        <InspectorGroup>
          <ExpandableBlockText title="Edit HTML" block={block}>
            {(rows) => (
              <Field label="HTML">
                {(control) => (
                  <Textarea
                    {...control}
                    rows={Math.max(rows, 8)}
                    value={block.html}
                    onChange={(event) => onUpdate({ html: event.target.value })}
                    placeholder="Enter HTML content"
                    spellCheck={false}
                    className="font-mono text-xs"
                  />
                )}
              </Field>
            )}
          </ExpandableBlockText>
          <BlockPreview block={block} />
        </InspectorGroup>
      )}
    </DisplayBlockWrapper>
  );
}
