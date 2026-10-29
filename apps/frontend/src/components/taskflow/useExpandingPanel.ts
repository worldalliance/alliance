import { prefersReducedMotion } from "@alliance/sharedweb/lib/reducedMotion";
import { useCallback, useRef, type RefObject } from "react";
import { afterMotion, flowMotion, transition } from "./flowMotion";

/** Marks the element the flow grows out of, such as the homepage task card. */
export const TASK_FLOW_ORIGIN = "task-flow-origin";

const OPEN = "inset(0px round 0px)";

/** A clip-path that shows only the part of `panel` over `origin`. */
function clipTo(panel: HTMLElement, origin: Element): string {
  const p = panel.getBoundingClientRect();
  const o = origin.getBoundingClientRect();
  const px = (n: number) => `${Math.max(0, n)}px`;
  return `inset(${px(o.top - p.top)} ${px(p.right - o.right)} ${px(p.bottom - o.bottom)} ${px(o.left - p.left)} round 6px)`;
}

/**
 * Grows the panel out of the task container it opened from, and shrinks it
 * back before it closes. `anchorRef` sits inside that container.
 */
export function useExpandingPanel(anchorRef: RefObject<HTMLElement | null>) {
  const panel = useRef<HTMLDivElement | null>(null);

  const origin = useCallback(
    () =>
      anchorRef.current?.closest(`.${TASK_FLOW_ORIGIN}`) ??
      anchorRef.current?.parentElement ??
      null,
    [anchorRef],
  );

  const panelRef = useCallback(
    (element: HTMLDivElement | null) => {
      panel.current = element;
      const from = origin();
      if (!element || !from || prefersReducedMotion()) return;
      element.style.transition = "none";
      element.style.clipPath = clipTo(element, from);
      // Reading layout commits the starting clip before the transition starts.
      element.getBoundingClientRect();
      element.style.transition = transition(flowMotion.expand, "clip-path");
      element.style.clipPath = OPEN;
    },
    [origin],
  );

  const collapse = async () => {
    const element = panel.current;
    const to = origin();
    if (!element || !to || prefersReducedMotion()) return;
    element.style.transition = [
      transition(flowMotion.collapse, "clip-path"),
      transition(flowMotion.collapseFade, "opacity"),
    ].join(", ");
    element.style.clipPath = clipTo(element, to);
    element.style.opacity = "0";
    await afterMotion(flowMotion.collapse, flowMotion.collapseFade);
  };

  return { panel, panelRef, collapse };
}
