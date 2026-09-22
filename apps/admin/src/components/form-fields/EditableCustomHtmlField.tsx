import type { CustomHtmlField } from "@alliance/common/forms/form-schema";
import { CUSTOM_HTML_VALUE_ATTRIBUTE } from "@alliance/shared/forms/customHtml";
import { css as cssLanguage } from "@codemirror/lang-css";
import { html as htmlLanguage } from "@codemirror/lang-html";
import { javascript as javascriptLanguage } from "@codemirror/lang-javascript";
import CodeMirror from "@uiw/react-codemirror";
import { useDeferredValue, useState } from "react";
import { RequiredToggle } from "./CommonControls";
import { CustomHtmlPreview } from "./CustomHtmlPreview";
import { FieldLabelEditor } from "./FieldLabelEditor";
import { FieldWrapper } from "./FieldWrapper";
import type { BaseFieldProps } from "./types";

const TABS = [
  { key: "html", label: "HTML", extension: htmlLanguage },
  { key: "css", label: "CSS", extension: cssLanguage },
  { key: "js", label: "JS", extension: javascriptLanguage },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function EditableCustomHtmlField({
  field,
  onUpdate,
  onRemove,
  onDragStart,
  onDragEnd,
  isDragging,
  previousFields,
}: BaseFieldProps<CustomHtmlField>) {
  const [tab, setTab] = useState<TabKey>("html");

  // Re-running the preview on every keystroke reloads the iframe mid-typing;
  // deferring lets React skip the intermediate states while input stays live.
  const previewField = useDeferredValue({
    html: field.html,
    css: field.css,
    js: field.js,
  });

  const active = TABS.find((entry) => entry.key === tab) ?? TABS[0];

  return (
    <FieldWrapper
      field={field}
      onUpdate={onUpdate}
      previousFields={previousFields}
      onRemove={onRemove}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      isDragging={isDragging}
    >
      <FieldLabelEditor
        value={field.label}
        onChange={(v) => onUpdate({ label: v })}
      />

      <RequiredToggle
        checked={field.required}
        onChange={(checked) => onUpdate({ required: checked })}
      />

      <p className="text-xs text-gray-600">
        The answer is read from whichever element carries{" "}
        <code className="rounded bg-gray-100 px-1">
          {CUSTOM_HTML_VALUE_ATTRIBUTE}
        </code>
        , or from{" "}
        <code className="rounded bg-gray-100 px-1">
          Alliance.setValue(value)
        </code>{" "}
        in your script. Your CSS is scoped to this field, so it cannot restyle
        the rest of the form.
      </p>

      <div className="space-y-1">
        <div className="flex gap-1">
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setTab(entry.key)}
              className={
                "rounded-t border border-b-0 px-3 py-1 text-xs " +
                (entry.key === tab
                  ? "border-gray-300 bg-white font-medium text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-800")
              }
            >
              {entry.label}
            </button>
          ))}
        </div>

        {/* One editor per tab rather than one that swaps language: remounting
            keeps each language's own undo history and folding intact. */}
        {TABS.map((entry) => (
          <div key={entry.key} hidden={entry.key !== active.key}>
            <CodeMirror
              value={field[entry.key] ?? ""}
              extensions={[entry.extension()]}
              onChange={(next) =>
                onUpdate(
                  entry.key === "html"
                    ? { html: next }
                    : entry.key === "css"
                      ? { css: next || undefined }
                      : { js: next || undefined },
                )
              }
              basicSetup={{ lineNumbers: true, foldGutter: false }}
              minHeight="120px"
              maxHeight="320px"
              className="rounded border border-gray-300 overflow-hidden text-sm"
            />
          </div>
        ))}
      </div>

      <div className="space-y-1">
        <span className="block text-xs font-medium text-gray-700">Preview</span>
        <CustomHtmlPreview field={previewField} />
      </div>
    </FieldWrapper>
  );
}
