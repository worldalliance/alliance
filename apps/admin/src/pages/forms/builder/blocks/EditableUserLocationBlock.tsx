import type { UserLocationBlock } from "@alliance/common/forms/display-blocks";
import { InspectorGroup } from "../kit/InspectorGroup";
import { BlockTextField } from "./BlockTextField";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

export function EditableUserLocationBlock(
  props: BaseDisplayBlockProps<UserLocationBlock>,
) {
  return (
    <DisplayBlockWrapper {...props}>
      {({ block, onUpdate }) => (
        <InspectorGroup>
          <BlockTextField
            label="Title"
            mark="optional"
            value={block.title ?? ""}
            onChange={(title) => onUpdate({ title: title || undefined })}
            placeholder="Your location"
          />
          <BlockTextField
            label="Empty-state text"
            mark="optional"
            help="Shown when the member has no location set."
            value={block.emptyText ?? ""}
            onChange={(emptyText) =>
              onUpdate({ emptyText: emptyText || undefined })
            }
            placeholder="No location set"
          />
          <div className="flex flex-col gap-1.5">
            <p className="font-medium">Example</p>
            <div className="rounded-md bg-surface-2 px-3 py-2">
              {block.title && (
                <p className="text-caption text-fg-muted">{block.title}</p>
              )}
              <p>San Francisco, California, United States</p>
            </div>
          </div>
        </InspectorGroup>
      )}
    </DisplayBlockWrapper>
  );
}
