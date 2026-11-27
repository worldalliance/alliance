import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import type { ReactNode } from "react";
import { EditorSize, ExpandableEditor } from "../kit/ExpandableEditor";
import { BlockPreview, BlockPreviewAllowed } from "./BlockPreview";

const ROWS: Record<EditorSize, number> = {
  [EditorSize.Inspector]: 4,
  [EditorSize.Sheet]: 16,
};

/**
 * A block's long text control with "Open larger editor…", whose sheet shows
 * the block as members see it under the control, since the sheet covers the
 * canvas.
 */
export function ExpandableBlockText({
  title,
  block,
  children,
}: {
  title: string;
  /** The block to preview in the sheet; none for a block with no preview. */
  block?: DisplayBlock;
  children: (rows: number) => ReactNode;
}) {
  return (
    <ExpandableEditor
      title={title}
      render={(size) => children(ROWS[size])}
      preview={
        block &&
        (() => (
          <BlockPreviewAllowed.Provider value>
            <BlockPreview block={block} />
          </BlockPreviewAllowed.Provider>
        ))
      }
    />
  );
}
