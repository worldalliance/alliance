import { R } from "@alliance/common/result";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { isTextEntry } from "../lib/useDraftHistory";
import { Kbd } from "../ui/Kbd";
import Modal, { ModalBody, ModalHeader, ModalTitle } from "../ui/Modal";
import { Switch } from "../ui/Switch";

export type Shortcut = {
  /**
   * Keys pressed one after another, separated by spaces: `[`, `g t`. `mod+k`
   * is ⌘K on a Mac and Ctrl+K elsewhere; `mod+shift+z` is ⇧⌘Z (a letter only).
   */
  keys: string;
  /** What it does, as the shortcut list words it. */
  label: string;
  run: () => void;
  /** The shell's own; a page's shortcuts leave this out. */
  global?: boolean;
  /**
   * `false` leaves a `mod+` shortcut to a focused text field, as undo and
   * redo do, so the field's own undo runs there. Single keys never run in one.
   */
  allowInTextField?: boolean;
};

type Registry = {
  register: (id: string, shortcut: Shortcut) => () => void;
  openHelp: () => void;
  singleKeysOn: boolean;
};

const ShortcutsContext = createContext<Registry | null>(null);

const STORAGE_KEY = "alliance.admin.singleKeyShortcuts.v1";
const SEQUENCE_MS = 1000;
const MOD = "mod+";
const SHIFT = "shift+";

const readSingleKeysOn = (): boolean =>
  typeof window === "undefined" ||
  R.unwrapOr(
    R.fromThrowable(() => window.localStorage.getItem(STORAGE_KEY) !== "off"),
    true,
  );

const usesModifier = (keys: string) => keys.startsWith(MOD);

const isMac = () =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

/** The keys as printed: `mod+k` is ⌘K on a Mac. */
export const shortcutKeys = (keys: string): string[] => {
  if (!usesModifier(keys)) return keys.split(" ");
  const rest = keys.slice(MOD.length);
  const shift = rest.startsWith(SHIFT);
  const key = (shift ? rest.slice(SHIFT.length) : rest).toUpperCase();
  if (isMac()) return [`${shift ? "⇧" : ""}⌘${key}`];
  return [`Ctrl+${shift ? "Shift+" : ""}${key}`];
};

/** Whether one is the other, or the keys the other's sequence starts with. */
const collide = (a: string, b: string) =>
  a === b || a.startsWith(`${b} `) || b.startsWith(`${a} `);

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    target.matches(
      "input, textarea, select, [role=textbox], [role=combobox], [role=searchbox]",
    ));

function ShortcutList({
  shortcuts,
  singleKeysOn,
  onSingleKeysChange,
  onClose,
}: {
  shortcuts: Shortcut[];
  singleKeysOn: boolean;
  onSingleKeysChange: (on: boolean) => void;
  onClose: () => void;
}) {
  const switchId = useId();
  const sections = [
    { title: "This page", shortcuts: shortcuts.filter((s) => !s.global) },
    { title: "Anywhere", shortcuts: shortcuts.filter((s) => s.global) },
  ].filter((section) => section.shortcuts.length > 0);
  return (
    <Modal onClose={onClose} panelClassName="max-w-lg">
      <ModalHeader>
        <ModalTitle>Keyboard shortcuts</ModalTitle>
      </ModalHeader>
      <ModalBody className="flex flex-col gap-section">
        {sections.map((section) => (
          <section key={section.title}>
            <h3 className="pb-1 text-caption font-medium text-fg-muted">
              {section.title}
            </h3>
            <ul>
              {section.shortcuts.map((shortcut) => (
                <li
                  key={shortcut.keys}
                  className="flex h-control-sm items-center justify-between gap-4"
                >
                  <span
                    className={
                      !singleKeysOn && !usesModifier(shortcut.keys)
                        ? "text-fg-muted line-through"
                        : undefined
                    }
                  >
                    {shortcut.label}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {shortcutKeys(shortcut.keys).map((key, index) => (
                      // A sequence may repeat a key, and its parts never reorder.
                      <span key={index} className="flex items-center gap-1">
                        {index > 0 && (
                          <span className="text-caption text-fg-muted">
                            then
                          </span>
                        )}
                        <Kbd>{key}</Kbd>
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <div className="flex items-center justify-between gap-4 border-t border-line pt-4">
          <label htmlFor={switchId} className="flex flex-col">
            <span className="font-medium">Single-key shortcuts</span>
            <span className="text-caption text-fg-muted">
              Off leaves only the ones that use ⌘ or Ctrl. This list stays in
              the account menu.
            </span>
          </label>
          <Switch
            id={switchId}
            checked={singleKeysOn}
            onCheckedChange={onSingleKeysChange}
          />
        </div>
      </ModalBody>
    </Modal>
  );
}

/**
 * The one keyboard listener of the shell. Shortcuts register with it, so each
 * is listed under `?`, none collides with another, and the single-key ones can
 * all be turned off.
 */
export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const [shortcuts, setShortcuts] = useState<ReadonlyMap<string, Shortcut>>(
    () => new Map(),
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const [singleKeysOn, setSingleKeysOn] = useState(readSingleKeysOn);
  const latest = useRef({ shortcuts, singleKeysOn });
  latest.current = { shortcuts, singleKeysOn };

  const register = useCallback((id: string, shortcut: Shortcut) => {
    const shifted = shortcut.keys.startsWith(MOD + SHIFT)
      ? shortcut.keys.slice((MOD + SHIFT).length)
      : null;
    // With Shift held the browser reports the shifted character, `?` for `/`.
    if (shifted !== null && !/^[a-z]$/.test(shifted)) {
      throw new Error(
        `shortcut ${shortcut.keys} ("${shortcut.label}") never fires: only a letter takes mod+shift+`,
      );
    }
    setShortcuts((prev) => {
      const taken = [...prev].find(
        ([otherId, other]) =>
          otherId !== id && collide(other.keys, shortcut.keys),
      );
      if (taken) {
        throw new Error(
          `shortcut ${taken[1].keys} is already "${taken[1].label}"; "${shortcut.label}" needs other keys than ${shortcut.keys}`,
        );
      }
      return new Map(prev).set(id, shortcut);
    });
    return () =>
      setShortcuts((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
  }, []);

  useEffect(() => {
    let pending = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reset = () => {
      pending = "";
      clearTimeout(timer);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return;
      const all = [...latest.current.shortcuts.values()];
      // AltGr and a Mac's Option type a character, such as `[` on a German
      // layout; Windows reports AltGr as Ctrl+Alt.
      const altGraph = !isMac() && event.ctrlKey && event.altKey;
      const altTypes = altGraph || isMac();
      if ((event.metaKey || event.ctrlKey) && !altGraph) {
        reset();
        // Only the platform's own modifier: Ctrl+K on a Mac deletes to the end of the line.
        const mod = isMac() ? !event.ctrlKey : !event.metaKey;
        const combo = `${MOD}${event.shiftKey ? SHIFT : ""}${event.key.toLowerCase()}`;
        const shortcut = all.find((candidate) => candidate.keys === combo);
        if (!mod || !shortcut || event.altKey) return;
        if (
          shortcut.allowInTextField === false &&
          isTextEntry(event.target)
        ) {
          return;
        }
        event.preventDefault();
        shortcut.run();
        return;
      }
      if (
        !latest.current.singleKeysOn ||
        (event.altKey && !altTypes) ||
        event.key.length !== 1 ||
        isTyping(event.target) ||
        // A dialog or sheet owns the keyboard while it is open.
        document.querySelector("[role=dialog], [role=alertdialog]")
      ) {
        reset();
        return;
      }
      // Caps Lock upper-cases a letter; Shift picks a different key, such as `?`.
      const key = event.shiftKey ? event.key : event.key.toLowerCase();
      // A key that doesn't continue the sequence is tried on its own.
      const candidates = pending ? [`${pending} ${key}`, key] : [key];
      reset();
      for (const typed of candidates) {
        const shortcut = all.find((candidate) => candidate.keys === typed);
        if (shortcut) {
          event.preventDefault();
          shortcut.run();
          return;
        }
        if (all.some((c) => c.keys.startsWith(`${typed} `))) {
          pending = typed;
          timer = setTimeout(reset, SEQUENCE_MS);
          return;
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearTimeout(timer);
    };
  }, []);

  const registry = useMemo(
    () => ({ register, openHelp: () => setHelpOpen(true), singleKeysOn }),
    [register, singleKeysOn],
  );

  return (
    <ShortcutsContext.Provider value={registry}>
      {children}
      {helpOpen && (
        <ShortcutList
          shortcuts={[...shortcuts.values()]}
          singleKeysOn={singleKeysOn}
          onSingleKeysChange={(on) => {
            setSingleKeysOn(on);
            R.fromThrowable(() =>
              window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off"),
            );
          }}
          onClose={() => setHelpOpen(false)}
        />
      )}
    </ShortcutsContext.Provider>
  );
}

const useRegistry = (): Registry => {
  const registry = useContext(ShortcutsContext);
  if (!registry) throw new Error("no ShortcutsProvider above this component");
  return registry;
};

function useRegistered(registry: Registry | null, shortcut: Shortcut): void {
  const register = registry?.register;
  const id = useId();
  const run = useRef(shortcut.run);
  run.current = shortcut.run;
  const { keys, label, global, allowInTextField } = shortcut;
  useEffect(
    () =>
      register?.(id, {
        keys,
        label,
        global,
        allowInTextField,
        run: () => run.current(),
      }),
    [register, id, keys, label, global, allowInTextField],
  );
}

/**
 * Registers a keyboard shortcut while the component is mounted. A page's own
 * shortcut is listed under "This page" in the `?` list.
 */
export function useShortcut(shortcut: Shortcut): void {
  useRegistered(useRegistry(), shortcut);
}

/**
 * `useShortcut` for a shared component that also renders outside the shell,
 * such as on a full-screen page, where it binds nothing.
 */
export function useShortcutInShell(shortcut: Shortcut): void {
  useRegistered(useContext(ShortcutsContext), shortcut);
}

/** Whether single-key shortcuts run, for a hint that names one. */
export const useSingleKeysOn = (): boolean => useRegistry().singleKeysOn;

/** Opens the shortcut list, for a menu item that offers it. */
export const useOpenShortcutList = (): (() => void) => useRegistry().openHelp;
