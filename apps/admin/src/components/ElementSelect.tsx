import type { DisplayKind } from "@alliance/common/forms/display-blocks";
import { isDisplayOnlyBlockKind } from "@alliance/common/forms/display-only-schema";
import {
  ADDABLE_FIELD_KINDS,
  DISPLAY_KIND_NAMES,
  DISPLAY_KINDS,
  FIELD_KIND_NAMES,
} from "@alliance/common/forms/element-descriptors";
import type { FieldKind } from "@alliance/common/forms/form-schema";

interface ElementSelectProps {
  onAddField: (kind: FieldKind) => void;
  onAddDisplayBlock: (kind: DisplayKind) => void;
  onAddGroup?: () => void;
  /** Opens an inline picker to insert a copy of an existing element. */
  onCopyExisting: () => void;
  displayOnly?: boolean;
}

const DISPLAY_ONLY_BLOCK_TYPES = DISPLAY_KINDS.filter(isDisplayOnlyBlockKind);

export function ElementSelect({
  onAddField,
  onAddDisplayBlock,
  onAddGroup,
  onCopyExisting,
  displayOnly = false,
}: ElementSelectProps) {
  const blockTypes = displayOnly ? DISPLAY_ONLY_BLOCK_TYPES : DISPLAY_KINDS;
  return (
    <div className="w-64 bg-white shadow-sm border-r border-gray-200 flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 pb-6">
        <div className="space-y-4">
          {!displayOnly && (
            <div>
              <h4 className="font-medium mb-2">Input Fields</h4>
              <div className="space-y-2">
                {ADDABLE_FIELD_KINDS.map((type) => (
                  <button
                    key={type}
                    onClick={() => onAddField(type)}
                    className="w-full text-left px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors"
                  >
                    {FIELD_KIND_NAMES[type]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="font-medium mb-2">Display Blocks</h4>
            <div className="space-y-2">
              {blockTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => onAddDisplayBlock(type)}
                  className="w-full text-left px-3 py-2 text-sm bg-green/10 hover:bg-green/20 rounded-md border border-green/30 transition-colors"
                >
                  {DISPLAY_KIND_NAMES[type]}
                </button>
              ))}
            </div>
          </div>

          {!displayOnly && (
            <div>
              <h4 className="font-medium mb-2">Layout</h4>
              <button
                onClick={() => onAddGroup?.()}
                className="w-full text-left px-3 py-2 text-sm bg-amber-50 hover:bg-amber-100 rounded-md border border-amber-200 transition-colors"
              >
                Group
              </button>
            </div>
          )}

          {!displayOnly && (
            <div>
              <h4 className="font-medium mb-2">Copy Existing</h4>
              <button
                onClick={onCopyExisting}
                className="w-full text-left px-3 py-2 text-sm bg-purple-50 hover:bg-purple-100 rounded-md border border-purple-200 transition-colors"
              >
                Copy Existing Element
              </button>
            </div>
          )}

          {/* Extra spacing at bottom to ensure last item is fully visible */}
          <div className="h-4"></div>
        </div>
      </div>
    </div>
  );
}
