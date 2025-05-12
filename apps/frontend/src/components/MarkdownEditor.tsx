import React, { useState } from "react";
import ReactMarkdown from "react-markdown";

export type MarkdownEditorMode = "edit" | "preview" | "split";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
  label?: string;
  required?: boolean;
  initialMode?: MarkdownEditorMode;
  showSyntaxHelp?: boolean;
  className?: string;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder = "Write content here. Markdown formatting is supported.",
  minRows = 10,
  label = "Content (Markdown supported)",
  required = false,
  initialMode = "edit",
  showSyntaxHelp = true,
  className = "",
}) => {
  const [viewMode, setViewMode] = useState<MarkdownEditorMode>(initialMode);

  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      <div className="flex justify-between items-center">
        <label
          htmlFor="markdown-editor"
          className="font-avenir text-[11pt] text-stone-800 mb-1"
        >
          {label}
        </label>
        <div className="flex items-center gap-3">
          <div className="flex border rounded overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("edit")}
              className={`px-3 py-1 text-xs font-medium ${
                viewMode === "edit"
                  ? "bg-cyan-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setViewMode("split")}
              className={`px-3 py-1 text-xs font-medium ${
                viewMode === "split"
                  ? "bg-cyan-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Split
            </button>
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={`px-3 py-1 text-xs font-medium ${
                viewMode === "preview"
                  ? "bg-cyan-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Preview
            </button>
          </div>
        </div>
      </div>

      <div className={`${viewMode === "split" ? "flex gap-4" : "block"}`}>
        {(viewMode === "edit" || viewMode === "split") && (
          <div className={viewMode === "split" ? "flex-1" : "w-full"}>
            {viewMode === "split" && (
              <div className="text-xs text-gray-500 mb-1 font-medium">
                Editor
              </div>
            )}
            <textarea
              id="markdown-editor"
              name="markdown-editor"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              required={required}
              rows={minRows}
              className="w-full border border-gray-300 rounded-md px-3 py-3 pb-2 bg-white 
                focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500
                text-[11pt] font-avenir transition-all duration-200 hover:border-gray-400"
            />

            {viewMode === "edit" && showSyntaxHelp && (
              <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
                <div className="font-medium mb-1">Markdown Syntax:</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <code className="bg-gray-100 px-1 py-0.5 rounded">
                      **Bold**
                    </code>{" "}
                    for <strong>Bold</strong>
                  </div>
                  <div>
                    <code className="bg-gray-100 px-1 py-0.5 rounded">
                      *Italic*
                    </code>{" "}
                    for <em>Italic</em>
                  </div>
                  <div>
                    <code className="bg-gray-100 px-1 py-0.5 rounded">
                      # Heading 1
                    </code>{" "}
                    for headings
                  </div>
                  <div>
                    <code className="bg-gray-100 px-1 py-0.5 rounded">
                      - Item
                    </code>{" "}
                    for bullet lists
                  </div>
                  <div>
                    <code className="bg-gray-100 px-1 py-0.5 rounded">
                      [Link](URL)
                    </code>{" "}
                    for links
                  </div>
                  <div>
                    <code className="bg-gray-100 px-1 py-0.5 rounded">
                      ![Alt](URL)
                    </code>{" "}
                    for images
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {(viewMode === "preview" || viewMode === "split") && (
          <div className={viewMode === "split" ? "flex-1" : "w-full"}>
            {viewMode === "split" && (
              <div className="text-xs text-gray-500 mb-1 font-medium">
                Preview
              </div>
            )}
            <div className="border border-gray-300 rounded-md p-4 min-h-[200px] bg-white prose prose-stone max-w-none overflow-auto">
              {value ? (
                <ReactMarkdown>{value}</ReactMarkdown>
              ) : (
                <p className="text-gray-400 italic">
                  Preview will appear here...
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarkdownEditor;