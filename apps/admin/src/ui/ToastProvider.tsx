import {
  ToastProvider as SharedToastProvider,
  useToast as useSharedToast,
} from "@alliance/sharedweb/ui/ToastProvider";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import ConfirmDialog from "./ConfirmDialog";

// The shared form renderer and shared hooks call `useToast` on the shared
// context, so the admin mounts that provider and adds its own confirm dialog
// inside it. Toasts keep the shared look until sharedweb exposes the context.
export {
  ConfirmMode,
  ToastPlacement,
  ToastVariant,
} from "@alliance/sharedweb/ui/ToastProvider";

type SharedToast = ReturnType<typeof useSharedToast>;

// `mode`, `anchorEl` and `placement` are ignored: every confirm is the admin's
// centred dialog. Pages not yet redesigned still pass them; new code doesn't.
export type ConfirmOptions = Parameters<SharedToast["confirm"]>[0] & {
  /** Danger-styled confirm button. Implied by the label "Delete". */
  destructive?: boolean;
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

type Pending = {
  id: number;
  options: ConfirmOptions;
  settle: (v: boolean) => void;
};

const ConfirmContext = createContext<Confirm | undefined>(undefined);

let nextId = 0;

const askKey = (o: ConfirmOptions) =>
  JSON.stringify([
    o.title,
    o.message,
    o.confirmLabel,
    o.cancelLabel,
    o.requiredText,
    o.requiredTextLabel,
    o.requiredTextPlaceholder,
    o.destructive,
  ]);

function ConfirmHost({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Pending[]>([]);
  const open = useRef(new Set<string>());

  const confirm = useCallback<Confirm>((options) => {
    const { signal } = options;
    if (signal?.aborted) return Promise.resolve(false);
    // A second identical ask, such as a double press, is declined: sharing
    // the open dialog's answer would run its caller's write twice.
    const key = askKey(options);
    if (open.current.has(key)) return Promise.resolve(false);
    open.current.add(key);
    return new Promise<boolean>((resolve) => {
      const id = ++nextId;
      const settle = (value: boolean) => {
        signal?.removeEventListener("abort", onAbort);
        open.current.delete(key);
        setQueue((prev) => prev.filter((p) => p.id !== id));
        resolve(value);
      };
      const onAbort = () => settle(false);
      signal?.addEventListener("abort", onAbort, { once: true });
      setQueue((prev) => [...prev, { id, options, settle }]);
    });
  }, []);

  const current = queue[0];

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {current && (
        <ConfirmDialog
          key={current.id}
          open
          title={current.options.title ?? "Are you sure?"}
          message={current.options.message}
          confirmLabel={current.options.confirmLabel}
          cancelLabel={current.options.cancelLabel}
          destructive={
            current.options.destructive ??
            current.options.confirmLabel?.toLowerCase() === "delete"
          }
          requiredText={current.options.requiredText}
          requiredTextLabel={current.options.requiredTextLabel}
          requiredTextPlaceholder={current.options.requiredTextPlaceholder}
          onConfirm={() => current.settle(true)}
          onCancel={() => current.settle(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <SharedToastProvider>
      <ConfirmHost>{children}</ConfirmHost>
    </SharedToastProvider>
  );
}

/** The shared toasts, with `confirm` opening the admin's own dialog. */
export function useToast(): Omit<SharedToast, "confirm"> & {
  confirm: Confirm;
} {
  const shared = useSharedToast();
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error(
      "useToast must be used within the admin's <ToastProvider />",
    );
  }
  return useMemo(() => ({ ...shared, confirm }), [shared, confirm]);
}
