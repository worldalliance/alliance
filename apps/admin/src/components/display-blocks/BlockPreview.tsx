import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import RenderDisplayBlock from "@alliance/sharedweb/forms/RenderDisplayBlock";
import { useState } from "react";

/**
 * A block editor's rendering of its block as respondents see it: always shown
 * under the editor, or behind a Show preview toggle.
 */
export function BlockPreview({
  block,
  toggleable = false,
}: {
  block: DisplayBlock;
  toggleable?: boolean;
}) {
  const [shown, setShown] = useState(false);

  if (!toggleable) {
    return (
      <div className="pt-2 border-t border-gray-200">
        <RenderDisplayBlock block={block} />
      </div>
    );
  }
  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setShown((prev) => !prev)}
          className="text-xs font-medium text-green hover:text-emerald-700"
        >
          {shown ? "Hide preview" : "Show preview"}
        </button>
      </div>
      {shown && (
        <div className="border border-gray-200 rounded-md p-3 bg-white">
          <RenderDisplayBlock block={block} />
        </div>
      )}
    </>
  );
}
