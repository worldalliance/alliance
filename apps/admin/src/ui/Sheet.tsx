import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type React from "react";
import type { ReactNode } from "react";
import { cn } from "./cn";
import { zIndex } from "./zIndex";

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  headerActions?: ReactNode;
  panelClassName?: string;
};

/** A dialog anchored to the right edge. */
const Sheet: React.FC<SheetProps> = ({
  open,
  onClose,
  title,
  children,
  headerActions,
  panelClassName,
}) => (
  <Dialog.Root
    open={open}
    onOpenChange={(nextOpen) => {
      if (!nextOpen) onClose();
    }}
  >
    <Dialog.Portal>
      <Dialog.Backdrop
        className={cn(zIndex.drawer, "fixed inset-0 bg-scrim")}
      />
      <Dialog.Viewport
        onClick={(event) => event.stopPropagation()}
        className={cn(zIndex.drawer, "fixed inset-y-0 right-0 flex")}
      >
        <Dialog.Popup
          className={cn(
            "flex h-full w-screen max-w-3xl flex-col bg-surface text-body text-fg shadow-pop outline-none",
            panelClassName,
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-card py-3">
            <Dialog.Title className="min-w-0 truncate text-heading font-semibold">
              {title}
            </Dialog.Title>
            <div className="flex shrink-0 items-center gap-1">
              {headerActions}
              <Dialog.Close
                aria-label="Close"
                className="rounded-md p-1.5 text-fg-muted focus-ring hover:bg-surface-2 hover:text-fg"
              >
                <X aria-hidden="true" className="size-5" />
              </Dialog.Close>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>
);

export default Sheet;
