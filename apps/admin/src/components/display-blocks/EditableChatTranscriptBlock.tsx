import type {
  ChatTranscriptBlock,
  ChatTranscriptMessage,
} from "@alliance/common/forms/display-blocks";
import { InspectorGroup } from "../../pages/forms/builder/kit/InspectorGroup";
import {
  AddItemButton,
  ItemList,
  ItemRow,
} from "../../pages/forms/builder/kit/ItemList";
import { Input } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { Field } from "../../ui/templates/Form";
import { neighborMoves } from "../form-canvas/ChildRows";
import { choiceOf } from "./blockChoices";
import { BlockPreview } from "./BlockPreview";
import { BlockTextField } from "./BlockTextField";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

type Side = ChatTranscriptMessage["side"];

const SIDES: readonly { value: Side; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

export function EditableChatTranscriptBlock(
  props: BaseDisplayBlockProps<ChatTranscriptBlock>,
) {
  return (
    <DisplayBlockWrapper {...props}>
      {({ block, onUpdate }) => (
        <>
          <InspectorGroup>
            <div className="grid grid-cols-2 gap-3">
              <BlockTextField
                label="Left name"
                value={block.leftName ?? ""}
                onChange={(leftName) =>
                  onUpdate({ leftName: leftName || undefined })
                }
              />
              <BlockTextField
                label="Right name"
                value={block.rightName ?? ""}
                onChange={(rightName) =>
                  onUpdate({ rightName: rightName || undefined })
                }
              />
            </div>
            <Field
              label="Size"
              mark="optional"
              help="Caps the card's height; the transcript scrolls beyond it. Leave empty for no limit."
            >
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min={1}
                  value={block.size ?? ""}
                  onChange={(event) => {
                    const parsed = Number(event.target.value);
                    onUpdate({ size: parsed > 0 ? parsed : undefined });
                  }}
                />
              )}
            </Field>
          </InspectorGroup>
          <InspectorGroup title="Messages">
            <Messages
              messages={block.messages}
              onChange={(messages) => onUpdate({ messages })}
            />
            <BlockPreview block={block} toggleable />
          </InspectorGroup>
        </>
      )}
    </DisplayBlockWrapper>
  );
}

function Messages({
  messages,
  onChange,
}: {
  messages: ChatTranscriptMessage[];
  onChange: (messages: ChatTranscriptMessage[]) => void;
}) {
  const update = (index: number, updates: Partial<ChatTranscriptMessage>) =>
    onChange(
      messages.map((message, i) =>
        i === index ? { ...message, ...updates } : message,
      ),
    );
  const add = () => {
    const lastSide = messages.at(-1)?.side;
    onChange([
      ...messages,
      { side: lastSide === "left" ? "right" : "left", text: "" },
    ]);
  };

  return (
    <>
      {messages.length > 0 && (
        <ItemList label="Messages">
          {messages.map((message, index) => (
            <ItemRow
              key={index}
              name={`Message ${index + 1}`}
              {...neighborMoves(messages, index, onChange)}
              onRemove={() => onChange(messages.filter((_, i) => i !== index))}
              removeLabel="Remove message"
            >
              <Field label="Side">
                {(control) => (
                  <Select
                    {...control}
                    aria-label={`Message ${index + 1} side`}
                    value={message.side}
                    onChange={(event) => {
                      const side = choiceOf(SIDES, event.target.value);
                      if (side) update(index, { side });
                    }}
                  >
                    {SIDES.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <BlockTextField
                label="Text"
                ariaLabel={`Message ${index + 1} text`}
                help="Written in markdown."
                multiline
                rows={2}
                value={message.text}
                onChange={(text) => update(index, { text })}
              />
            </ItemRow>
          ))}
        </ItemList>
      )}
      <AddItemButton onClick={add}>Add message</AddItemButton>
    </>
  );
}
