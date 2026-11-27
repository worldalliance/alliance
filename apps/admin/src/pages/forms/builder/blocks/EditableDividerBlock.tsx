import type { DividerBlock } from "@alliance/common/forms/display-blocks";
import { Select } from "../../../../ui/Select";
import { Field } from "../../../../ui/templates/Form";
import { InspectorGroup } from "../kit/InspectorGroup";
import { choiceOf } from "./blockChoices";
import { BlockPreview } from "./BlockPreview";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

type Thickness = NonNullable<DividerBlock["thickness"]>;

const THICKNESSES: readonly { value: Thickness; label: string }[] = [
  { value: "hairline", label: "Hairline" },
  { value: "thin", label: "Thin" },
  { value: "medium", label: "Medium" },
  { value: "thick", label: "Thick" },
];

export function EditableDividerBlock(
  props: BaseDisplayBlockProps<DividerBlock>,
) {
  return (
    <DisplayBlockWrapper {...props}>
      {({ block, onUpdate }) => (
        <InspectorGroup>
          <Field label="Thickness">
            {(control) => (
              <Select
                {...control}
                value={block.thickness ?? "thin"}
                onChange={(event) => {
                  const thickness = choiceOf(THICKNESSES, event.target.value);
                  if (thickness) onUpdate({ thickness });
                }}
              >
                {THICKNESSES.map(({ value, label }) => (
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
