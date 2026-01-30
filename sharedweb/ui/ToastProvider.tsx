import {
  createContext,
  type CSSProperties,
  type FC,
  type KeyboardEventHandler,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type ToastVariant = "info" | "success" | "error" | "warning" | "confirm";

type ToastBase = {
  id: number;
  variant: ToastVariant;
  title?: string;
  message?: string;
};

type ConfirmOptions = {
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  anchorEl?: HTMLElement | null;
  placement?:
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "topleft"
  | "topright"
  | "bottomleft"
  | "bottomright";
  mode?: "popover" | "fullscreen";
  requiredText?: string;
  requiredTextLabel?: string;
  requiredTextPlaceholder?: string;
};

type ToastOptions = Omit<ToastBase, "id" | "variant"> & {
  variant?: Exclude<ToastVariant, "confirm">;
  durationMs?: number;
};

type ToastConfirm = ToastBase & {
  anchorEl?: HTMLElement | null;
  placement?:
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "topleft"
  | "topright"
  | "bottomleft"
  | "bottomright";
  variant: "confirm";
  confirmLabel: string;
  cancelLabel: string;
  resolve: (value: boolean) => void;
  mode: "popover" | "fullscreen";
  requiredText?: string;
  requiredTextLabel?: string;
  requiredTextPlaceholder?: string;
};

type AnyToast = ToastBase | ToastConfirm;

type ToastContextValue = {
  showToast: (opts: ToastOptions) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a <ToastProvider />");
  }
  return ctx;
}

export const ToastProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<AnyToast[]>([]);
  const idRef = useRef(0);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ variant = "info", title, message, durationMs = 4000 }: ToastOptions) => {
      const id = ++idRef.current;
      const toast: AnyToast = { id, variant, title, message };
      setToasts((prev) => [...prev, toast]);

      if (durationMs != null) {
        setTimeout(() => removeToast(id), durationMs);
      }
    },
    [removeToast]
  );

  const confirm = useCallback(
    ({
      title,
      message,
      confirmLabel = "Confirm",
      cancelLabel = "Cancel",
      anchorEl,
      placement,
      mode,
      requiredText,
      requiredTextLabel,
      requiredTextPlaceholder,
    }: ConfirmOptions): Promise<boolean> => {
      const id = ++idRef.current;

      return new Promise<boolean>((resolve) => {
        const toast: ToastConfirm = {
          id,
          variant: "confirm",
          title,
          message,
          confirmLabel,
          cancelLabel,
          anchorEl,
          placement,
          resolve,
          mode: mode ?? (requiredText ? "fullscreen" : "popover"),
          requiredText,
          requiredTextLabel,
          requiredTextPlaceholder,
        };
        setToasts((prev) => [...prev, toast]);
      });
    },
    []
  );

  const handleConfirm = useCallback(
    (toast: ToastConfirm, value: boolean) => {
      toast.resolve(value);
      removeToast(toast.id);
    },
    [removeToast]
  );

  const value: ToastContextValue = {
    showToast,
    success: (message, title) =>
      showToast({ variant: "success", message, title }),
    error: (message, title) => showToast({ variant: "error", message, title }),
    info: (message, title) => showToast({ variant: "info", message, title }),
    warning: (message, title) =>
      showToast({ variant: "warning", message, title }),
    confirm,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast container */}
      <div className="z-50 pointer-events-none fixed inset-0 flex flex-col items-end gap-2 px-4 py-6 sm:bottom-0 sm:items-end">
        {toasts.map((toast) => {
          if (toast.variant === "confirm") {
            return (
              <ConfirmToastItem
                key={toast.id}
                toast={toast as ToastConfirm}
                onConfirm={handleConfirm}
              />
            );
          }

          return (
            <DefaultToastItem
              key={toast.id}
              toast={toast as ToastBase}
              onDismiss={removeToast}
            />
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

type DefaultToastItemProps = {
  toast: ToastBase;
  onDismiss: (id: number) => void;
};

const DefaultToastItem: FC<DefaultToastItemProps> = ({ toast, onDismiss }) => {
  const colorClasses =
    toast.variant === "success"
      ? "bg-emerald-600 text-white"
      : toast.variant === "error"
        ? "bg-white text-red-500 border border-red-500"
        : toast.variant === "warning"
          ? "bg-amber-500 text-white"
          : "bg-slate-700 text-white";

  return (
    <div
      className={`pointer-events-auto mb-2 w-full max-w-sm rounded-xl shadow-lg ring-1 ring-black/5 ${colorClasses}`}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex-1">
          {toast.title && (
            <h3 className="text-sm font-semibold mb-1">{toast.title}</h3>
          )}
          <p className="text-sm">{toast.message}</p>
        </div>

        <button
          type="button"
          className="ml-2 text-slate-100/70 hover:text-white"
          onClick={() => onDismiss(toast.id)}
        >
          ✕
        </button>
      </div>
    </div>
  );
};

type ConfirmToastItemProps = {
  toast: ToastConfirm;
  onConfirm: (toast: ToastConfirm, value: boolean) => void;
};

const ConfirmToastItem: FC<ConfirmToastItemProps> = ({ toast, onConfirm }) => {
  const [inputValue, setInputValue] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const requiresText = toast.requiredText;
  const isFullscreen = toast.mode === "fullscreen";
  const confirmDisabled =
    !!requiresText &&
    inputValue.trim() !== (requiresText ? requiresText.trim() : "");
  const confirmLabelTone = toast.confirmLabel.toLowerCase();
  const confirmAccentClass =
    confirmLabelTone === "delete"
      ? "bg-red-600 text-white hover:bg-red-700"
      : confirmLabelTone === "create"
        ? "bg-green text-white hover:bg-green-700"
        : "bg-zinc-900 text-white hover:bg-zinc-800";
  const popoverConfirmTextClass =
    confirmLabelTone === "delete"
      ? "text-red-500"
      : confirmLabelTone === "create"
        ? "text-emerald-600"
        : "text-black";

  const handleConfirmClick = () => {
    if (confirmDisabled) {
      return;
    }
    onConfirm(toast, true);
  };

  const handleCancelClick = () => {
    onConfirm(toast, false);
  };

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === "Enter" && !confirmDisabled) {
      event.preventDefault();
      onConfirm(toast, true);
    }
  };

  // ️Close on outside click
  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;

      const target = event.target as Node | null;
      // If click is inside the toast, do nothing
      if (target && el.contains(target)) return;

      // Otherwise treat as cancel
      onConfirm(toast, false);
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, [onConfirm, toast]);

  const modalContent = (
    <div
      ref={containerRef}
      className="pointer-events-auto w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl"
    >
      {toast.title && <h3 className="text-lg font-semibold">{toast.title}</h3>}
      <p className="mt-2 text-sm text-zinc-700">{toast.message}</p>
      {requiresText && (
        <div className="mt-4 space-y-2">
          <label className="block text-sm font-medium text-zinc-900">
            {toast.requiredTextLabel ??
              `Type "${requiresText}" to confirm this action.`}
          </label>
          <input
            autoFocus
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring focus:ring-zinc-200"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder={toast.requiredTextPlaceholder ?? requiresText}
            onKeyDown={handleKeyDown}
          />
        </div>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          onClick={handleCancelClick}
        >
          {toast.cancelLabel}
        </button>
        <button
          type="button"
          className={`rounded-md px-4 py-2 text-sm font-semibold transition ${confirmDisabled
            ? "cursor-not-allowed bg-zinc-200 text-zinc-400"
            : confirmAccentClass
            }`}
          onClick={handleConfirmClick}
          disabled={confirmDisabled}
        >
          {toast.confirmLabel}
        </button>
      </div>
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="pointer-events-auto absolute inset-0 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm px-4">
        {modalContent}
      </div>
    );
  }

  let style: CSSProperties = {};
  if (toast.anchorEl) {
    const rect = toast.anchorEl.getBoundingClientRect();
    const placement = toast.placement || "bottom";
    style = { position: "fixed" };
    const margin = 8;

    switch (placement) {
      case "top":
        style = {
          ...style,
          top: rect.top - margin,
          left: rect.left + rect.width / 2,
          transform: "translate(-50%, -100%)",
        };
        break;
      case "bottom":
        style = {
          ...style,
          top: rect.bottom + margin,
          left: rect.left + rect.width / 2,
          transform: "translate(-50%, 0)",
        };
        break;
      case "left":
        style = {
          ...style,
          top: rect.top + rect.height / 2,
          left: rect.left - margin,
          transform: "translate(-100%, -50%)",
        };
        break;
      case "right":
        style = {
          ...style,
          top: rect.top + rect.height / 2,
          left: rect.right + margin,
          transform: "translate(0, -50%)",
        };
        break;
      case "topleft":
        style = {
          ...style,
          top: rect.top - margin,
          left: rect.right,
          transform: "translate(-100%, -100%)",
        };
        break;
      case "topright":
        style = {
          ...style,
          top: rect.top - margin,
          left: rect.right + margin,
          transform: "translate(0, -100%)",
        };
        break;
      case "bottomleft":
        style = {
          ...style,
          top: rect.bottom + margin,
          left: rect.left - margin,
          transform: "translate(-100%, 0)",
        };
        break;
      case "bottomright":
        style = {
          ...style,
          top: rect.bottom + margin,
          left: rect.right + margin,
          transform: "translate(0, 0)",
        };
        break;
    }
  }

  return (
    <div
      ref={containerRef}
      style={style}
      className="pointer-events-auto mb-2 w-full max-w-sm rounded border border-zinc-200 bg-white text-black shadow"
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex-1">
          {toast.title && (
            <h3 className="font-semibold text-zinc-900">
              {toast.title}
            </h3>
          )}
          {toast.message && (
            <p className="mt-1 text-sm text-zinc-700">{toast.message}</p>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 px-4 pb-4">
        <button
          type="button"
          className="rounded-md px-3 py-1 font-medium text-zinc-500 hover:bg-zinc-100"
          onClick={handleCancelClick}
        >
          {toast.cancelLabel}
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-1 font-medium hover:bg-zinc-100 ${popoverConfirmTextClass} ${confirmDisabled ? "cursor-not-allowed opacity-60" : ""
            }`}
          onClick={handleConfirmClick}
          disabled={confirmDisabled}
        >
          {toast.confirmLabel}
        </button>
      </div>
    </div>
  );
};
