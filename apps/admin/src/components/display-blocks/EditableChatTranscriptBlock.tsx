import type {
  ChatTranscriptBlock,
  ChatTranscriptMessage,
} from "@alliance/common/forms/display-blocks";
import { cn } from "@alliance/shared/styles/util";
import RenderDisplayBlock from "@alliance/sharedweb/forms/RenderDisplayBlock";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useState } from "react";
import { VariableTextField } from "../VariableTextField";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

export function EditableChatTranscriptBlock({
  block,
  onUpdate,
  updateCurrent,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  previousFields,
}: BaseDisplayBlockProps<ChatTranscriptBlock>) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <DisplayBlockWrapper
      onRemove={onRemove}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      isDragging={isDragging}
      block={block}
      onUpdate={onUpdate}
      updateCurrent={updateCurrent}
      previousFields={previousFields}
    >
      {({ block: activeBlock, onUpdate: handleUpdate }) => {
        const messages = activeBlock.messages;

        const updateMessage = (
          index: number,
          updates: Partial<ChatTranscriptMessage>,
        ) => {
          handleUpdate({
            messages: messages.map((message, i) =>
              i === index ? { ...message, ...updates } : message,
            ),
          });
        };

        const removeMessage = (index: number) => {
          handleUpdate({ messages: messages.filter((_, i) => i !== index) });
        };

        const moveMessage = (index: number, direction: -1 | 1) => {
          const target = index + direction;
          if (target < 0 || target >= messages.length) return;
          const reordered = [...messages];
          [reordered[index], reordered[target]] = [
            reordered[target],
            reordered[index],
          ];
          handleUpdate({ messages: reordered });
        };

        const addMessage = () => {
          const lastSide = messages[messages.length - 1]?.side;
          handleUpdate({
            messages: [
              ...messages,
              { side: lastSide === "left" ? "right" : "left", text: "" },
            ],
          });
        };

        return (
          <div className="space-y-2">
            <div className="flex gap-2">
              <VariableTextField
                value={activeBlock.leftName ?? ""}
                onChange={(leftName) =>
                  handleUpdate({ leftName: leftName || undefined })
                }
                className="flex-1 text-gray-900 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Left user name"
              />
              <VariableTextField
                value={activeBlock.rightName ?? ""}
                onChange={(rightName) =>
                  handleUpdate({ rightName: rightName || undefined })
                }
                className="flex-1 text-gray-900 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Right user name"
              />
              <input
                type="number"
                min={1}
                value={activeBlock.size ?? ""}
                onChange={(e) => {
                  const parsed = Number(e.target.value);
                  handleUpdate({
                    size: parsed > 0 ? parsed : undefined,
                  });
                }}
                className="w-36 text-gray-900 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Size"
                title="Card height cap. The transcript scrolls beyond it. Leave empty for no limit."
              />
            </div>
            {messages.map((message, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="flex rounded-md border border-zinc-300 overflow-hidden shrink-0">
                  {(["left", "right"] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => updateMessage(index, { side })}
                      className={cn(
                        "px-2 py-1.5 text-xs capitalize",
                        message.side === side
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "bg-white text-zinc-500 hover:bg-zinc-50",
                      )}
                    >
                      {side}
                    </button>
                  ))}
                </div>
                <VariableTextField
                  multiline
                  value={message.text}
                  onChange={(text) => updateMessage(index, { text })}
                  minRows={1}
                  className="flex-1 text-gray-900 border border-gray-300 rounded-md px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Markdown message text"
                />
                <button
                  type="button"
                  title="Move up"
                  onClick={() => moveMessage(index, -1)}
                  disabled={index === 0}
                  className="p-1 text-zinc-400 hover:text-zinc-600 disabled:opacity-30"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  title="Move down"
                  onClick={() => moveMessage(index, 1)}
                  disabled={index === messages.length - 1}
                  className="p-1 text-zinc-400 hover:text-zinc-600 disabled:opacity-30"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  title="Remove message"
                  onClick={() => removeMessage(index)}
                  className="p-1 text-zinc-400 hover:text-red-600"
                >
                  <X size={14} />
                </button>
              </div>
            ))}

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={addMessage}
                className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
              >
                <Plus size={14} />
                Add message
              </button>
              <button
                type="button"
                onClick={() => setShowPreview((prev) => !prev)}
                className="text-xs font-medium text-green hover:text-emerald-700"
              >
                {showPreview ? "Hide preview" : "Show preview"}
              </button>
            </div>

            {showPreview && (
              <div className="border border-gray-200 rounded-md p-3 bg-white">
                <RenderDisplayBlock
                  block={{
                    ...activeBlock,
                    kind: "chatTranscript",
                  }}
                />
              </div>
            )}
          </div>
        );
      }}
    </DisplayBlockWrapper>
  );
}
