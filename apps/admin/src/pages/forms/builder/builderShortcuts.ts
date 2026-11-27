import { useShortcutInShell } from "../../../shell/shortcuts";

// A popover's popup is a dialog too, but one placed beside its trigger, so it
// carries `data-side`; only a modal blocks saving.
const dialogOpen = () =>
  document.querySelector('[role="dialog"]:not([data-side])') !== null;

/** ⌘S saves, and `p` switches between Edit and Preview, while the builder is mounted. */
export function useBuilderShortcuts({
  save,
  togglePreview,
}: {
  save: () => void;
  /** Null where the builder has no Preview, as on its other tabs. */
  togglePreview: (() => void) | null;
}) {
  useShortcutInShell({
    keys: "mod+s",
    label: "Save the form",
    // A `mod+` shortcut runs behind an open dialog too.
    run: () => {
      if (!dialogOpen()) save();
    },
  });
  useShortcutInShell({
    keys: "p",
    label: "Switch between edit and preview",
    run: () => togglePreview?.(),
  });
}
