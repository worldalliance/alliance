import { cn } from "@alliance/shared/styles/util";
import {
  Dialog,
  type DialogRootChangeEventReason,
} from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type React from "react";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { zIndex } from "./zIndex";

export type ModalProps = {
  open?: boolean;
  onClose: () => void;
  children: ReactNode;
  /**
   * Panel classes. Sizing and internal layout stay with the caller; these merge
   * over the shell's defaults.
   */
  panelClassName?: string;
  dismissOnBackdrop?: boolean;
  dismissOnEscape?: boolean;
  /** Has no effect unless the modal contains a `ModalHeader`. */
  showClose?: boolean;
  /**
   * Suspends every route above at once, for work in flight that shouldn't be
   * abandoned half-done. The close button stays visible but disabled — the
   * affordance shouldn't move under the pointer mid-save.
   */
  dismissDisabled?: boolean;
  /** Only for panels with no visible heading — otherwise use `ModalTitle`. */
  ariaLabel?: string;
  /**
   * Keydown on the panel. `event.target === event.currentTarget` means the
   * panel shell itself holds focus — the state a shortcut can claim without
   * stealing the key from a control inside.
   */
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
};

/**
 * The dialog's accessible name. Registers its own id with the dialog, so the
 * panel is labelled without the caller threading one through.
 */
export const ModalTitle = Dialog.Title;

/**
 * The dialog's accessible description — the prose a screen reader announces
 * along with the title when focus enters the panel. Registers its own id, like
 * `ModalTitle`.
 */
export const ModalDescription = Dialog.Description;

const CloseButton: React.FC<{ disabled?: boolean }> = ({ disabled }) => (
  <Dialog.Close
    aria-label="Close"
    disabled={disabled}
    className="absolute top-4 right-4 rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
  >
    <X aria-hidden="true" className="size-5" />
  </Dialog.Close>
);

const ModalCloseContext = createContext<{
  showClose: boolean;
  dismissDisabled: boolean;
}>({ showClose: false, dismissDisabled: false });

export type ModalHeaderProps = {
  children: ReactNode;
  /**
   * Header classes. Padding, borders and inner layout stay with the caller;
   * these merge over the shell's defaults.
   */
  className?: string;
};

/**
 * Right padding holding the close button's corner clear of the header's
 * contents. Applied after the caller's classes so general padding cannot
 * override the gutter.
 */
export const MODAL_CLOSE_GUTTER = "pr-14";

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  children,
  className,
}) => {
  const { showClose, dismissDisabled } = useContext(ModalCloseContext);

  return (
    <div
      data-modal-header=""
      className={cn(
        "relative border-b border-zinc-200 p-5",
        className,
        showClose && MODAL_CLOSE_GUTTER,
      )}
    >
      {showClose && <CloseButton disabled={dismissDisabled} />}
      {children}
    </div>
  );
};

export type ModalFooterProps = {
  children: ReactNode;
  /**
   * Footer classes. Padding, borders and inner layout stay with the caller;
   * these merge over the shell's defaults.
   */
  className?: string;
};

export const ModalFooter: React.FC<ModalFooterProps> = ({
  children,
  className,
}) => (
  <div className={cn("border-t border-zinc-200 p-5", className)}>
    {children}
  </div>
);

export type ModalActionsProps = {
  children: ReactNode;
  className?: string;
};

export const ModalActions: React.FC<ModalActionsProps> = ({
  children,
  className,
}) => (
  <div
    className={cn("flex flex-wrap items-center justify-end gap-2", className)}
  >
    {children}
  </div>
);

// Types cannot require a name because it may come from a `ModalTitle` nested
// anywhere in the panel, and base-ui does not warn about anonymous dialogs.
const useAccessibleNameWarning = (
  panelRef: React.RefObject<HTMLDivElement | null>,
  open: boolean,
) => {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !open) return;

    // Deferred, because neither half of the answer exists yet at this point:
    // the panel is portalled, so it mounts on a later commit than this effect
    // (`panelRef` is still null here), and `ModalTitle` registers its id with
    // the dialog, so `aria-labelledby` lands a commit later again. Checking
    // synchronously reads a null ref and silently never warns at all.
    const timer = setTimeout(() => {
      const panel = panelRef.current;
      if (!panel) return;
      if (panel.getAttribute("aria-labelledby")) return;
      if (panel.getAttribute("aria-label")) return;

      console.error(
        "<Modal> renders no accessible name. Put a <ModalTitle> inside it, or pass `ariaLabel` if the panel has no visible heading.",
      );
    }, 0);

    return () => clearTimeout(timer);
  }, [panelRef, open]);
};

const Modal: React.FC<ModalProps> = ({
  open = true,
  onClose,
  children,
  panelClassName,
  ariaLabel,
  onKeyDown,
  dismissOnBackdrop = true,
  dismissOnEscape = true,
  showClose = true,
  dismissDisabled = false,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useAccessibleNameWarning(panelRef, open);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        if (nextOpen) return;
        if (dismissDisabled) return;
        const allowed: Record<DialogRootChangeEventReason, boolean> = {
          "close-press": true,
          // Neither reason is reachable through this component's API: it
          // exposes no trigger or imperative handle.
          "trigger-press": true,
          "imperative-action": true,
          none: true,
          // `focus-out` belongs with the backdrop: both are the user landing
          // somewhere outside the panel without meaning to leave it.
          "outside-press": dismissOnBackdrop,
          "focus-out": dismissOnBackdrop,
          "escape-key": dismissOnEscape,
        };
        if (!allowed[eventDetails.reason]) return;
        onClose();
      }}
      disablePointerDismissal={!dismissOnBackdrop}
    >
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(zIndex.modal, "fixed inset-0 bg-black/40")}
        />
        <Dialog.Viewport
          className={cn(zIndex.modal, "fixed inset-0 overflow-y-auto p-4")}
        >
          {/*
           * Scrolling lives on the viewport and centering on this wrapper:
           * `items-center` on the scroll container itself would clip the top of
           * a panel taller than the screen, and page scroll is locked while a
           * modal is open, so clipped content would be unreachable.
           */}
          <div className="flex min-h-full items-center justify-center">
            <Dialog.Popup
              ref={panelRef}
              // Focus the panel rather than its first tabbable control, so
              // opening a dialog never pre-arms a specific action.
              initialFocus={panelRef}
              onKeyDown={onKeyDown}
              aria-label={ariaLabel}
              className={cn(
                "relative w-full max-w-md rounded-lg bg-white shadow-xl outline-none",
                panelClassName,
              )}
            >
              <ModalCloseContext.Provider
                value={{ showClose, dismissDisabled }}
              >
                {children}
              </ModalCloseContext.Provider>
            </Dialog.Popup>
          </div>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default Modal;
