import { cn } from "@alliance/shared/styles/util";
import { useMediaQuery } from "@alliance/sharedweb/lib/useMediaQuery";
import { PanelLeft, PanelRight, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/** The selection's select button, marked pressed, within `root`. */
export const selectedOnCanvas = (root: HTMLElement | null) =>
  root?.querySelector<HTMLElement>('[aria-pressed="true"]');

/** At this width and up the outline and settings sidebar stay beside the canvas. */
export const useWideCanvasLayout = () => useMediaQuery("(min-width: 1024px)");

/**
 * The outline, canvas, and settings, each scrolling on its own. Below the
 * wide layout, the outline and settings open as drawers over the canvas.
 */
export function CanvasWorkspace({
  wide,
  outline,
  canvasKey,
  canvas,
  revealPending,
  onRevealed,
  settings,
  settingsKey,
  drawer,
  onDrawerChange,
}: {
  wide: boolean;
  outline: ReactNode;
  /** A new key starts the canvas scrolled to the top, as for another page. */
  canvasKey: string;
  canvas: ReactNode;
  /** Scrolls the canvas to the selection, as after choosing it in the outline. */
  revealPending: boolean;
  onRevealed: () => void;
  settings: ReactNode;
  /**
   * Changes when settings show something else. Focus left inside settings
   * that lose their focused control to the change returns to them.
   */
  settingsKey: string;
  drawer: DrawerKind | null;
  onDrawerChange: (drawer: DrawerKind | null) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const focusSelection = useCallback(
    () => selectedOnCanvas(canvasRef.current)?.focus(),
    [],
  );
  useEffect(() => {
    if (!revealPending) return;
    selectedOnCanvas(canvasRef.current)?.scrollIntoView({ block: "nearest" });
    onRevealed();
  }, [revealPending, onRevealed]);
  const settingsRef = useRef<HTMLDivElement>(null);
  const focusedInSettings = useRef<Element | null>(null);
  useEffect(() => {
    const forget = (event: FocusEvent) => {
      if (
        !(event.target instanceof Node) ||
        !settingsRef.current?.contains(event.target)
      ) {
        focusedInSettings.current = null;
      }
    };
    document.addEventListener("focusin", forget);
    return () => document.removeEventListener("focusin", forget);
  }, []);
  const shownKey = useRef(settingsKey);
  useEffect(() => {
    if (shownKey.current === settingsKey) return;
    shownKey.current = settingsKey;
    const active = document.activeElement;
    if (
      focusedInSettings.current?.isConnected === false &&
      (!active || active === document.body)
    ) {
      settingsRef.current?.focus();
    }
  }, [settingsKey]);

  const trackedSettings = (
    <div
      ref={settingsRef}
      tabIndex={-1}
      onFocus={(event) => {
        focusedInSettings.current = event.target;
      }}
      className="focus:outline-none"
    >
      {settings}
    </div>
  );

  return (
    <div className="relative flex min-h-0 flex-1">
      {wide ? (
        <nav
          aria-label="Outline"
          className="w-60 shrink-0 overflow-y-auto border-r border-gray-200 bg-white"
        >
          {outline}
        </nav>
      ) : (
        drawer === DrawerKind.Outline && (
          <Drawer
            kind={DrawerKind.Outline}
            onClose={() => onDrawerChange(null)}
            focusSelection={focusSelection}
          >
            {outline}
          </Drawer>
        )
      )}
      <div
        key={canvasKey}
        ref={canvasRef}
        role="region"
        aria-label="Form canvas"
        className="min-w-0 flex-1 overflow-y-auto p-6 pl-10"
      >
        {!wide && (
          <div className="mx-auto mb-2 flex max-w-2xl justify-between">
            <button
              type="button"
              onClick={() => onDrawerChange(DrawerKind.Outline)}
              aria-label="Open outline"
              title="Open outline"
              aria-expanded={drawer === DrawerKind.Outline}
              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <PanelLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => onDrawerChange(DrawerKind.Settings)}
              aria-label="Open settings"
              title="Open settings"
              aria-expanded={drawer === DrawerKind.Settings}
              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <PanelRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
        {canvas}
      </div>
      {wide ? (
        <aside
          aria-label="Settings"
          className="w-[26rem] shrink-0 overflow-y-auto border-l border-gray-200 bg-white"
        >
          {trackedSettings}
        </aside>
      ) : (
        drawer === DrawerKind.Settings && (
          <Drawer
            kind={DrawerKind.Settings}
            onClose={() => onDrawerChange(null)}
            focusSelection={focusSelection}
          >
            {trackedSettings}
          </Drawer>
        )
      )}
    </div>
  );
}

export enum DrawerKind {
  Outline = "outline",
  Settings = "settings",
}

const DRAWERS: Record<DrawerKind, { label: string; className: string }> = {
  [DrawerKind.Outline]: {
    label: "Outline",
    className: "left-0 max-w-xs border-r",
  },
  [DrawerKind.Settings]: {
    label: "Settings",
    className: "right-0 max-w-md border-l",
  },
};

/**
 * Takes focus when it opens, unless something inside already has it, and
 * hands it back to whatever had it when it closes, or to the selection on
 * the canvas once that's gone, as an insert picker is after inserting.
 */
function Drawer({
  kind,
  onClose,
  focusSelection,
  children,
}: {
  kind: DrawerKind;
  onClose: () => void;
  focusSelection: () => void;
  children: ReactNode;
}) {
  const { label, className } = DRAWERS[kind];
  const ref = useRef<HTMLElement>(null);
  const [invoker] = useState(() => document.activeElement);

  useEffect(() => {
    const drawer = ref.current;
    if (drawer && !drawer.contains(document.activeElement)) drawer.focus();
    return () => {
      if (invoker instanceof HTMLElement && invoker.isConnected) {
        invoker.focus();
      } else {
        focusSelection();
      }
    };
  }, [focusSelection, invoker]);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      onClose();
    }
  };

  return (
    <aside
      ref={ref}
      aria-label={label}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className={cn(
        "absolute inset-y-0 z-40 flex w-full flex-col border-gray-200 bg-white shadow-xl focus:outline-none",
        className,
      )}
    >
      <div className="flex justify-end px-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${label.toLowerCase()}`}
          title={`Close ${label.toLowerCase()}`}
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}
