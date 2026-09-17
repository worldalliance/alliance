import { cn } from "@alliance/shared/styles/util";
import { zIndex } from "@alliance/sharedweb/ui/zIndex";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type React from "react";
import type { ReactNode } from "react";

export type SideDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  headerActions?: ReactNode;
  panelClassName?: string;
};

/** On the same dialog primitive as `sharedweb/ui/Modal`, anchored right. */
const SideDrawer: React.FC<SideDrawerProps> = ({
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
        className={cn(zIndex.drawer, "fixed inset-0 bg-black/30")}
      />
      <Dialog.Viewport
        onClick={(event) => event.stopPropagation()}
        className={cn(zIndex.drawer, "fixed inset-y-0 right-0 flex")}
      >
        <Dialog.Popup
          className={cn(
            "flex h-full w-screen max-w-[46rem] flex-col bg-white shadow-2xl outline-none",
            panelClassName,
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-3">
            <Dialog.Title className="min-w-0 truncate text-base font-semibold text-zinc-900">
              {title}
            </Dialog.Title>
            <div className="flex shrink-0 items-center gap-1">
              {headerActions}
              <Dialog.Close
                aria-label="Close"
                className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
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

export default SideDrawer;
