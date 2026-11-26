import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import RenderDisplayBlock from "@alliance/sharedweb/forms/RenderDisplayBlock";
import { createContext, useContext, useState } from "react";
import { CheckboxField } from "../../../../ui/templates/Form";

/** False where the editor's surroundings already render the block. */
export const BlockPreviewAllowed = createContext(true);

/**
 * A block editor's rendering of its block as members see it: under the
 * editor, behind a "Show preview" checkbox, or nothing where
 * BlockPreviewAllowed is false.
 */
export function BlockPreview({
  block,
  toggleable = false,
}: {
  block: DisplayBlock;
  toggleable?: boolean;
}) {
  const [shown, setShown] = useState(false);
  const allowed = useContext(BlockPreviewAllowed);

  if (!allowed) return null;
  return (
    <>
      {toggleable && (
        <CheckboxField
          label="Show preview"
          checked={shown}
          onChange={(event) => setShown(event.target.checked)}
        />
      )}
      {(shown || !toggleable) && (
        <div className="member-surface rounded-md border border-line bg-surface p-3">
          <RenderDisplayBlock block={block} />
        </div>
      )}
    </>
  );
}
