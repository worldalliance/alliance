import type { ReactNode } from "react";
import { cn } from "../../../../ui/cn";

/**
 * An item's text open for editing, floating over the item from its top edge
 * and growing down over what follows, so opening it moves nothing. The item
 * stays laid out beneath, hidden, and takes the edits as they are typed.
 * Its nearest positioned ancestor is the item's own frame.
 */
export function InlineTextOverlay({
  editor,
  children,
}: {
  /** Null while the text is closed. */
  editor: ReactNode;
  children: ReactNode;
}) {
  const open = editor !== null && editor !== undefined && editor !== false;
  return (
    <>
      <div
        className={cn(open && "invisible")}
        aria-hidden={open || undefined}
        inert={open}
      >
        {children}
      </div>
      {open && (
        <div className="absolute inset-x-0 top-0 z-20 min-h-full rounded-md bg-surface p-2 shadow-pop">
          {editor}
        </div>
      )}
    </>
  );
}
