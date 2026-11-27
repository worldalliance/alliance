import { Redo2, Undo2 } from "lucide-react";
import { useEffect, type RefObject } from "react";
import { isTextEntry } from "../../../../lib/useDraftHistory";
import Button, { ButtonVariant } from "../../../../ui/Button";
import { Kbd } from "../../../../ui/Kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../../ui/Tooltip";

type HistoryControlsProps = {
  /** Where the shortcuts apply, besides an unfocused page. */
  scope: RefObject<HTMLElement | null>;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

const BUTTONS = [
  { label: "Undo", keys: "⌘Z", Icon: Undo2, redo: false },
  { label: "Redo", keys: "⇧⌘Z", Icon: Redo2, redo: true },
] as const;

/**
 * Undo and redo buttons, with ⌘/Ctrl+Z, ⇧⌘/Ctrl+Z, and Ctrl+Y within `scope`
 * but outside a text control or dialog, where the browser's own undo applies.
 */
export function HistoryControls({
  scope,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: HistoryControlsProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      if (key === "y" && event.metaKey) return;
      const target = event.target;
      const inScope =
        target === document.body ||
        (target instanceof Node && !!scope.current?.contains(target));
      if (
        !inScope ||
        isTextEntry(event.target) ||
        (event.target instanceof Element &&
          event.target.closest('[role="dialog"]'))
      ) {
        return;
      }
      event.preventDefault();
      if (key === "y" || event.shiftKey) {
        if (canRedo) onRedo();
      } else if (canUndo) {
        onUndo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canRedo, canUndo, onRedo, onUndo, scope]);

  return BUTTONS.map(({ label, keys, Icon, redo }) => (
    <Tooltip key={label}>
      <TooltipTrigger
        render={
          <Button
            variant={ButtonVariant.Ghost}
            size="icon"
            aria-label={label}
            onClick={redo ? onRedo : onUndo}
            disabled={redo ? !canRedo : !canUndo}
          >
            <Icon aria-hidden="true" className="size-4" />
          </Button>
        }
      />
      <TooltipContent>
        {label} <Kbd>{keys}</Kbd>
      </TooltipContent>
    </Tooltip>
  ));
}
