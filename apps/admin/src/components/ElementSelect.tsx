import type { DisplayKind } from "@alliance/shared/forms/display-blocks";
import type { FieldKind } from "@alliance/shared/forms/formschema";

interface ElementSelectProps {
  onAddField: (kind: FieldKind) => void;
  onAddDisplayBlock: (kind: DisplayKind) => void;
}

export function ElementSelect({
  onAddField,
  onAddDisplayBlock,
}: ElementSelectProps) {
  const fieldTypes: FieldKind[] = [
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
    "custom",
  ];

  const blockTypes: DisplayKind[] = [
    "header",
    "text",
    "label",
    "divider",
    "spacer",
    "html",
    "image",
    "quote",
    "biglink",
  ];

  return (
    <div className="w-64 bg-white shadow-sm border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-medium text-gray-900">Form Elements</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-6">
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Input Fields
            </h4>
            <div className="space-y-2">
              {fieldTypes.map((type) => (
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

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">
              Display Blocks
            </h4>
            <div className="space-y-2">
              {blockTypes.map((type) => (
                <button
                  key={type}
                  onClick={() => onAddDisplayBlock(type)}
                  className="w-full text-left px-3 py-2 text-sm bg-green-50 hover:bg-green-100 rounded-md border border-green-200 transition-colors"
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)} Block
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
