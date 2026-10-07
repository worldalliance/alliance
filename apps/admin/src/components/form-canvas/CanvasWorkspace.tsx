import { useMediaQuery } from "@alliance/sharedweb/lib/useMediaQuery";
import { PanelRight, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/** At this width and up the settings sidebar stays beside the canvas. */
export const useWideCanvasLayout = () => useMediaQuery("(min-width: 1024px)");

/**
 * The canvas and its settings, each scrolling on its own. Below the wide
 * layout, settings open as a drawer over the canvas.
 */
export function CanvasWorkspace({
  wide,
  canvasKey,
  canvas,
  settings,
  settingsKey,
  drawerOpen,
  onDrawerOpenChange,
}: {
  wide: boolean;
  /** A new key starts the canvas scrolled to the top, as for another page. */
  canvasKey: string;
  canvas: ReactNode;
  settings: ReactNode;
  /**
   * Changes when settings show something else. Focus left inside settings
   * that lose their focused control to the change returns to them.
   */
  settingsKey: string;
  drawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const focusSelection = useCallback(
    () =>
      canvasRef.current
        ?.querySelector<HTMLElement>('[aria-pressed="true"]')
        ?.focus(),
    [],
  );
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
      <div
        key={canvasKey}
        ref={canvasRef}
        className="min-w-0 flex-1 overflow-y-auto p-6 pl-10"
      >
        {!wide && (
          <div className="mx-auto mb-2 flex max-w-2xl justify-end">
            <button
              type="button"
              onClick={() => onDrawerOpenChange(true)}
              aria-label="Open settings"
              title="Open settings"
              aria-expanded={drawerOpen}
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
        drawerOpen && (
          <SettingsDrawer
            onClose={() => onDrawerOpenChange(false)}
            focusSelection={focusSelection}
          >
            {trackedSettings}
          </SettingsDrawer>
        )
      )}
    </div>
  );
}

/**
 * Takes focus when it opens, unless something inside already has it, and
 * hands it back to whatever had it when it closes, or to the selection on
 * the canvas once that's gone, as an insert picker is after inserting.
 */
function SettingsDrawer({
  onClose,
  focusSelection,
  children,
}: {
  onClose: () => void;
  focusSelection: () => void;
  children: ReactNode;
}) {
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
      aria-label="Settings"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="absolute inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-xl focus:outline-none"
    >
      <div className="flex justify-end px-2 pt-2">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          title="Close settings"
          className="flex h-8 w-8 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}
