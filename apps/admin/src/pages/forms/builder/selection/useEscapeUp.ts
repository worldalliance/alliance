import { type RefObject } from "react";
import { useShortcut } from "../../../../shell/shortcuts";
import { CanvasTargetKind, elementTarget } from "./canvasSelection";
import {
  InspectorScope,
  SECTION_ON_SELECT,
  type CanvasSelectionState,
} from "./useCanvasSelection";

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
 * on nothing. The shortcut registry leaves out text fields, menus, lists and
 * dialogs, which take Escape for themselves.
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
  useShortcut({
    keys: "escape",
    label: "Select the parent",
    run: () => {
      const focused = document.activeElement;
      if (
        !active ||
        (focused !== document.body && !root.current?.contains(focused))
      ) {
        return;
      }
      selectionAbove(canvas)?.();
    },
  });
}
