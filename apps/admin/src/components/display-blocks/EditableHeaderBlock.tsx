import type { HeaderBlock } from "@alliance/common/forms/display-blocks";
import { cn } from "@alliance/shared/styles/util";
import { VariableTextField } from "../VariableTextField";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

export function EditableHeaderBlock(props: BaseDisplayBlockProps<HeaderBlock>) {
  return (
    <DisplayBlockWrapper {...props}>
      {({ block: activeBlock, onUpdate: handleUpdate }) => (
        <div className="space-y-2">
          {/* Inline editable header */}
          <VariableTextField
            value={activeBlock.text}
            onChange={(text) => handleUpdate({ text })}
            className={cn(
              "w-full font-bold text-gray-900 border-none outline-none bg-transparent resize-none",
              (activeBlock.level || 2) === 1
                ? "text-3xl"
                : (activeBlock.level || 2) === 2
                  ? "text-2xl"
                  : (activeBlock.level || 2) === 3
                    ? "text-xl"
                    : (activeBlock.level || 2) === 4
                      ? "text-lg"
                      : (activeBlock.level || 2) === 5
                        ? "text-base"
                        : "text-sm",
            )}
            placeholder="Enter header text"
          />

          {/* Compact level selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Level:</span>
            <select
              value={activeBlock.level || 2}
              onChange={(e) =>
                handleUpdate({
                  level: parseInt(e.target.value) as 1 | 2 | 3 | 4 | 5 | 6,
                })
              }
              className="text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={1}>H1</option>
              <option value={2}>H2</option>
              <option value={3}>H3</option>
              <option value={4}>H4</option>
              <option value={5}>H5</option>
              <option value={6}>H6</option>
            </select>
          </div>
        </div>
      )}
    </DisplayBlockWrapper>
  );
}
