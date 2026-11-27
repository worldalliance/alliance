import type { SpacerBlock } from "@alliance/common/forms/display-blocks";
import { Select } from "../../../../ui/Select";
import { Field } from "../../../../ui/templates/Form";
import { InspectorGroup } from "../kit/InspectorGroup";
import { choiceOf } from "./blockChoices";
import { BlockPreview } from "./BlockPreview";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

type Size = NonNullable<SpacerBlock["size"]>;

const SIZES: readonly { value: Size; label: string }[] = [
  { value: "xs", label: "XS" },
  { value: "sm", label: "S" },
  { value: "md", label: "M" },
  { value: "lg", label: "L" },
  { value: "xl", label: "XL" },
];

export function EditableSpacerBlock(props: BaseDisplayBlockProps<SpacerBlock>) {
  return (
    <DisplayBlockWrapper {...props}>
      {({ block, onUpdate }) => (
        <InspectorGroup>
          <Field label="Size">
            {(control) => (
              <Select
                {...control}
                value={block.size ?? "md"}
                onChange={(event) => {
                  const size = choiceOf(SIZES, event.target.value);
                  if (size) onUpdate({ size });
                }}
              >
                {SIZES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <BlockPreview block={block} />
        </InspectorGroup>
      )}
    </DisplayBlockWrapper>
  );
}
