import { useState, type ReactNode } from "react";
import Button, { ButtonVariant } from "../../../../ui/Button";
import Sheet from "../../../../ui/Sheet";

export enum EditorSize {
  Inspector = "inspector",
  Sheet = "sheet",
}

/**
 * A control too long for the inspector, with a button that opens the same
 * control at full size in a sheet. Edits in either are draft writes, so the
 * canvas behind the sheet follows them.
 */
export function ExpandableEditor({
  title,
  render,
  preview,
}: {
  /** The sheet's title, "Edit HTML"; it also names the opener for screen readers. */
  title: string;
  render: (size: EditorSize) => ReactNode;
  /** Under the control in the sheet. */
  preview?: () => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      {render(EditorSize.Inspector)}
      <Button
        variant={ButtonVariant.Ghost}
        size="small"
        aria-label={`Open larger editor: ${title}`}
        onClick={() => setOpen(true)}
      >
        Open larger editor…
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <div className="flex flex-col gap-5 p-card">
          {open && render(EditorSize.Sheet)}
          {open && preview?.()}
        </div>
      </Sheet>
    </div>
  );
}
