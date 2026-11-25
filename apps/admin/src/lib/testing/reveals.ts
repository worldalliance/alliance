import { spyOn } from "bun:test";
import * as reveal from "../../pages/forms/builder/kit/revealInPane";

/**
 * Records what the builder reveals during this test: each call's target, in
 * the order made. The builder reveals only through `revealInPane`, which
 * scrolls one pane; the spy still scrolls it.
 */
export function spyOnReveals() {
  const spy = spyOn(reveal, "revealInPane");
  return {
    targets: () => spy.mock.calls.map(([, target]) => target),
    clear: () => spy.mockClear(),
  };
}
