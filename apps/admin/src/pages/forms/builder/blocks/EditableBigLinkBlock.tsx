import {
  BigLinkAction,
  BigLinkColor,
  bigLinkIconOrDefault,
  type BigLinkBlock,
  type BigLinkIcon,
} from "@alliance/common/forms/display-blocks";
import { useState } from "react";
import { Input } from "../../../../ui/Input";
import { Select } from "../../../../ui/Select";
import {
  CheckboxField,
  Field,
  RadioGroupField,
} from "../../../../ui/templates/Form";
import { InspectorGroup } from "../kit/InspectorGroup";
import { ExternalShareTargetSelect } from "../questions/ExternalShareTargetSelect";
import { choiceOf } from "./blockChoices";
import { BlockPreview } from "./BlockPreview";
import { BlockTextField } from "./BlockTextField";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

const ICONS: readonly { value: BigLinkIcon; label: string }[] = [
  { value: "messages-square", label: "Messages" },
  { value: "file", label: "File" },
  { value: "file-text", label: "File text" },
  { value: "file-check", label: "File check" },
  { value: "signature", label: "Signature" },
  { value: "none", label: "No icon" },
];

const COLOR_NAMES: Record<BigLinkColor, string> = {
  [BigLinkColor.Grey]: "Grey",
  [BigLinkColor.Green]: "Green",
};
const COLORS = Object.values(BigLinkColor).map((value) => ({
  value,
  label: COLOR_NAMES[value],
}));

const ACTION_NAMES: Record<BigLinkAction, string> = {
  [BigLinkAction.Open]: "Open the link",
  [BigLinkAction.Copy]: "Copy the link",
};
const ACTIONS = Object.values(BigLinkAction).map((value) => ({
  value,
  label: ACTION_NAMES[value],
}));

enum LinkTo {
  Url = "url",
  Target = "target",
}

const LINK_TO = [
  { value: LinkTo.Url, label: "URL" },
  { value: LinkTo.Target, label: "Share target" },
];

export function EditableBigLinkBlock(
  props: BaseDisplayBlockProps<BigLinkBlock>,
) {
  return (
    <DisplayBlockWrapper {...props}>
      {({ block, onUpdate }) => (
        <>
          <InspectorGroup>
            <BlockTextField
              label="Link label"
              value={block.text}
              onChange={(text) => onUpdate({ text })}
            />
            <BlockTextField
              label="Body"
              mark="optional"
              multiline
              rows={2}
              value={block.body ?? ""}
              onChange={(body) => onUpdate({ body: body || undefined })}
            />
            <LinkSourceFields block={block} onUpdate={onUpdate} />
            <CheckboxField
              label="Show the link"
              checked={block.showUrl ?? false}
              onChange={(event) =>
                onUpdate({ showUrl: event.target.checked || undefined })
              }
            />
          </InspectorGroup>
          <InspectorGroup title="Look">
            <Field label="Icon">
              {(control) => (
                <Select
                  {...control}
                  value={bigLinkIconOrDefault(block.icon)}
                  onChange={(event) => {
                    const icon = choiceOf(ICONS, event.target.value);
                    if (icon) onUpdate({ icon });
                  }}
                >
                  {ICONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Color">
              {(control) => (
                <Select
                  {...control}
                  value={block.color ?? BigLinkColor.Grey}
                  onChange={(event) => {
                    const color = choiceOf(COLORS, event.target.value);
                    if (color) onUpdate({ color });
                  }}
                >
                  {COLORS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <RadioGroupField
              label="On click"
              choices={ACTIONS}
              value={block.action ?? BigLinkAction.Open}
              onChange={(action) => onUpdate({ action })}
            />
            <BlockPreview block={block} toggleable />
          </InspectorGroup>
        </>
      )}
    </DisplayBlockWrapper>
  );
}

function LinkSourceFields({
  block,
  onUpdate,
}: {
  block: BigLinkBlock;
  onUpdate: (updates: Partial<BigLinkBlock>) => void;
}) {
  const [pickingTarget, setPickingTarget] = useState(false);
  const linksToTarget = block.externalTargetId !== undefined || pickingTarget;

  return (
    <>
      <RadioGroupField
        label="Link to"
        choices={LINK_TO}
        value={linksToTarget ? LinkTo.Target : LinkTo.Url}
        onChange={(next) => {
          const toTarget = next === LinkTo.Target;
          setPickingTarget(toTarget);
          if (!toTarget) onUpdate({ externalTargetId: undefined });
        }}
      />
      {linksToTarget ? (
        <ExternalShareTargetSelect
          label="Share target"
          description="Each signed-in member's link carries their own code; everyone else gets the target's URL."
          value={block.externalTargetId ?? null}
          onChange={(target) =>
            onUpdate({ externalTargetId: target.id, url: target.url })
          }
          onClear={() => onUpdate({ externalTargetId: undefined })}
        />
      ) : (
        <Field label="URL">
          {(control) => (
            <Input
              {...control}
              value={block.url}
              onChange={(event) => onUpdate({ url: event.target.value })}
              placeholder="/path or https://..."
            />
          )}
        </Field>
      )}
    </>
  );
}
