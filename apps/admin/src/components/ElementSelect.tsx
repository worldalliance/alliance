import type { DisplayKind } from "@alliance/shared/forms/display-blocks";
import type { FieldKind } from "@alliance/shared/forms/formschema";

interface ElementSelectProps {
  onAddField: (kind: FieldKind) => void;
  onAddDisplayBlock: (kind: DisplayKind) => void;
  /** When true, only show Display Blocks (no input fields). */
  displayBlocksOnly?: boolean;
}

const FIELD_TYPES: FieldKind[] = [
  "textarea",
  "email",
  "phone",
  "number",
  "range",
  "checkbox",
  "radio",
  "select",
  "multiselect",
  "date",
  "time",
  "timezone",
  "city",
  "file",
  "contract",
  "list",
  "custom",
] as const;

const BLOCK_TYPES: DisplayKind[] = [
  "header",
  "text",
  "label",
  "divider",
  "spacer",
  "html",
  "image",
  "video",
  "quote",
  "biglink",
  "previousAnswer",
];

export function ElementSelect({
  onAddField,
  onAddDisplayBlock,
  displayBlocksOnly = false,
}: ElementSelectProps) {
  return (
    <div className="w-64 bg-white shadow-sm border-r border-gray-200 flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 pb-6">
        <div className="space-y-4">
          {!displayBlocksOnly && (
            <div>
              <h4 className="font-medium mb-2">Input Fields</h4>
              <div className="space-y-2">
                {FIELD_TYPES.map((type) => (
                  <button
                    key={type}
                    onClick={() => onAddField(type)}
                    className="w-full text-left px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition-colors"
                  >
                    {type === "custom"
                      ? "Custom Component Field"
                      : type === "textarea"
                      ? "Text Field"
                      : `${type.charAt(0).toUpperCase() + type.slice(1)} Field`}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="font-medium mb-2">Display Blocks</h4>
            <div className="space-y-2">
              {BLOCK_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => onAddDisplayBlock(type)}
                  className="w-full text-left px-3 py-2 text-sm bg-green/10 hover:bg-green/20 rounded-md border border-green/30 transition-colors"
                >
                  {type === "previousAnswer"
                    ? "Previous Answer Block"
                    : type.charAt(0).toUpperCase() + type.slice(1) + " Block"}
                </button>
              ))}
            </div>
          </div>

          {/* Extra spacing at bottom to ensure last item is fully visible */}
          <div className="h-4"></div>
        </div>
      </div>
    </div>
  );
}
