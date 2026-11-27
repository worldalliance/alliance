import { spyOn } from "bun:test";
import * as reveal from "../../pages/forms/builder/kit/revealInPane";

/**
 * Records what the builder reveals during this test: each call's target, in
 * the order made, and those revealed while their page was still hidden by
 * the settle gate, which can't scroll to them. The builder reveals only
 * through `revealInPane`, which scrolls one pane; the spy still scrolls it.
 */
export function spyOnReveals() {
  const original = reveal.revealInPane;
  const hidden: HTMLElement[] = [];
  const spy = spyOn(reveal, "revealInPane").mockImplementation(
    (pane, target, margin) => {
      if (target.closest('[aria-busy="true"]')) hidden.push(target);
      original(pane, target, margin);
    },
  );
  return {
    targets: () => spy.mock.calls.map(([, target]) => target),
    whileHidden: () => hidden,
    clear: () => spy.mockClear(),
  };
}
