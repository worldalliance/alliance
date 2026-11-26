import { useEffect, useRef, type RefObject } from "react";
import { isTextEntry } from "../../../../lib/useDraftHistory";
import { CanvasTargetKind, elementTarget } from "./canvasSelection";
import {
  InspectorScope,
  SECTION_ON_SELECT,
  type CanvasSelectionState,
} from "./useCanvasSelection";

/** Open popups, which take Escape to close themselves. */
const POPUP =
  '[role="menu"], [role="listbox"], [role="dialog"], [role="alertdialog"]';
/** Controls that take Escape for themselves. */
const OWNS_ESCAPE = `${POPUP}, [role="combobox"]`;

/** The selection one level up: child → element → page → Form, or null on Form. */
function selectionAbove(canvas: CanvasSelectionState): (() => void) | null {
  const { inspectorScope, resolvedTarget, currentPage, select, selectForm } =
    canvas;
  if (inspectorScope === InspectorScope.Form) return null;
  if (resolvedTarget.kind === CanvasTargetKind.Page) return selectForm;
  const element =
    resolvedTarget.kind === CanvasTargetKind.Element &&
    resolvedTarget.child !== undefined
      ? currentPage.fields[resolvedTarget.index]
      : undefined;
  if (element && resolvedTarget.kind === CanvasTargetKind.Element) {
    const target = elementTarget(element, resolvedTarget.index);
    return () => select(target, SECTION_ON_SELECT[target.kind]);
  }
  return () =>
    select(
      { kind: CanvasTargetKind.Page },
      SECTION_ON_SELECT[CanvasTargetKind.Page],
    );
}

/**
 * Escape moves the selection up a level while focus is in the builder, or
 * on nothing, and not in a text field, menu, list or dialog, which take
 * Escape for themselves.
 */
export function useEscapeUp({
  root,
  canvas,
  active,
}: {
  root: RefObject<HTMLElement | null>;
  canvas: CanvasSelectionState;
  active: boolean;
}) {
  const latest = useRef(canvas);
  useEffect(() => {
    latest.current = canvas;
  });
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const { target } = event;
      const inBuilder =
        target === document.body ||
        (target instanceof Node && !!root.current?.contains(target));
      if (
        !inBuilder ||
        isTextEntry(target) ||
        (target instanceof Element && target.closest(OWNS_ESCAPE)) ||
        document.querySelector(POPUP)
      ) {
        return;
      }
      const up = selectionAbove(latest.current);
      if (!up) return;
      event.preventDefault();
      up();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, root]);
}
