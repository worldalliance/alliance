import type { DisplayKind } from "@alliance/common/forms/display-blocks";
import type { FieldKind } from "@alliance/common/forms/form-schema";

interface ElementSelectProps {
  onAddField: (kind: FieldKind) => void;
  onAddDisplayBlock: (kind: DisplayKind) => void;
  /** Opens an inline picker to insert a copy of an existing element. */
  onCopyExisting: () => void;
  /** When true, only show Display Blocks (no input fields). */
  displayBlocksOnly?: boolean;
}

const FIELD_LABELS: Record<FieldKind, string> = {
  text: "Text Field",
  textarea: "Text Field",
  email: "Email Field",
  phone: "Phone Field",
  number: "Number Field",
  range: "Range Field",
  checkbox: "Checkbox Field",
  radio: "Radio Field",
  select: "Select Field",
  multiselect: "Multiselect Field",
  ranking: "Ranking Field",
  date: "Date Field",
  time: "Time Field",
  timezone: "Timezone Field",
  city: "City Field",
  file: "File Field",
  contract: "Contract Field",
  list: "List Field",
  custom: "Custom Component Field",
};
const FIELD_TYPES = (Object.keys(FIELD_LABELS) as FieldKind[]).filter(
  // `text` specifically is deprecated, all other fields are valid
  (kind) => kind !== "text",
);

const BLOCK_LABELS: Record<DisplayKind, string> = {
  header: "Header Block",
  text: "Text Block",
  label: "Label Block",
  divider: "Divider Block",
  spacer: "Spacer Block",
  html: "HTML Block",
  image: "Image Block",
  video: "Video Block",
  quote: "Quote Block",
  biglink: "Big Link Block",
  copytext: "Copy Text Block",
  previousAnswer: "Previous Answer Block",
  userLocation: "User Location Block",
  chatTranscript: "Chat Transcript Block",
};
const BLOCK_TYPES = Object.keys(BLOCK_LABELS) as DisplayKind[];

export function ElementSelect({
  onAddField,
  onAddDisplayBlock,
  onCopyExisting,
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
                    {FIELD_LABELS[type]}
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
                  {BLOCK_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">Copy Existing</h4>
            <button
              onClick={onCopyExisting}
              className="w-full text-left px-3 py-2 text-sm bg-purple-50 hover:bg-purple-100 rounded-md border border-purple-200 transition-colors"
            >
              Copy Existing Element
            </button>
          </div>

          {/* Extra spacing at bottom to ensure last item is fully visible */}
          <div className="h-4"></div>
        </div>
      </div>
    </div>
  );
}
