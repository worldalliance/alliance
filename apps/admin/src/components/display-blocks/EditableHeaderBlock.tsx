import type { HeaderBlock } from "@alliance/common/forms/display-blocks";
import { InspectorGroup } from "../../pages/forms/builder/kit/InspectorGroup";
import { Select } from "../../ui/Select";
import { Field } from "../../ui/templates/Form";
import { useSidebarSections } from "../form-canvas/sidebarSections";
import { choiceOf } from "./blockChoices";
import { BlockTextField } from "./BlockTextField";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

type Level = NonNullable<HeaderBlock["level"]>;

const LEVELS: readonly { value: Level; label: string }[] = [
  { value: 1, label: "H1" },
  { value: 2, label: "H2" },
  { value: 3, label: "H3" },
  { value: 4, label: "H4" },
  { value: 5, label: "H5" },
  { value: 6, label: "H6" },
];

export function EditableHeaderBlock(props: BaseDisplayBlockProps<HeaderBlock>) {
  const inSidebar = useSidebarSections() !== null;
  return (
    <DisplayBlockWrapper {...props}>
      {({ block, onUpdate }) => (
        <InspectorGroup>
          <BlockTextField
            label="Text"
            value={block.text}
            onChange={(text) => onUpdate({ text })}
            placeholder="Enter header text"
            help={
              inSidebar
                ? "Write headers in the active voice: “Select a date”, not “Date selection”."
                : undefined
            }
          />
          <Field label="Level">
            {(control) => (
              <Select
                {...control}
                value={block.level ?? 2}
                onChange={(event) => {
                  const level = choiceOf(LEVELS, event.target.value);
                  if (level) onUpdate({ level });
                }}
              >
                {LEVELS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </InspectorGroup>
      )}
    </DisplayBlockWrapper>
  );
}
