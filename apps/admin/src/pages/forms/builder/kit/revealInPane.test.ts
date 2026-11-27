import { describe, expect, it } from "bun:test";
import { focusInPlace, revealInPane } from "./revealInPane";

/** A pane 400 px tall at y 100, scrolled to 1000, holding `target` at its viewport position. */
function setup({ target }: { target: { top: number; height: number } }) {
  const pane = document.createElement("div");
  const child = document.createElement("div");
  pane.append(child);
  let scrollTop = 1000;
  const behaviors: (ScrollBehavior | undefined)[] = [];
  Object.defineProperty(pane, "scrollTop", { get: () => scrollTop });
  pane.scrollTo = (options?: ScrollToOptions | number) => {
    if (typeof options !== "object") throw new Error("scrollTo(x, y) unused");
    behaviors.push(options.behavior);
    scrollTop = options.top ?? scrollTop;
  };
  pane.getBoundingClientRect = () => DOMRect.fromRect({ y: 100, height: 400 });
  child.getBoundingClientRect = () =>
    DOMRect.fromRect({ y: target.top, height: target.height });
  return { pane, child, scrollTop: () => scrollTop, behaviors };
}

describe("revealInPane", () => {
  it("leaves a target already in view where it is", () => {
    const { pane, child, scrollTop } = setup({
      target: { top: 150, height: 100 },
    });
    revealInPane(pane, child);
    expect(scrollTop()).toBe(1000);
  });

  it("scrolls up the least distance, with the margin, to a target above the view", () => {
    const { pane, child, scrollTop } = setup({
      target: { top: 50, height: 100 },
    });
    revealInPane(pane, child);
    expect(scrollTop()).toBe(1000 - 50 - 24);
  });

  it("scrolls down the least distance, with the margin, to a target below the view", () => {
    const { pane, child, scrollTop } = setup({
      target: { top: 450, height: 100 },
    });
    revealInPane(pane, child);
    expect(scrollTop()).toBe(1000 + 50 + 24);
  });

  it("shows the top of a target taller than the pane", () => {
    const { pane, child, scrollTop } = setup({
      target: { top: 600, height: 900 },
    });
    revealInPane(pane, child);
    expect(scrollTop()).toBe(1000 + 500 - 24);
  });
});

describe("revealInPane's motion", () => {
  const withMotion = (reduce: boolean, run: () => void) => {
    const original = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => ({
        matches: reduce && query.includes("reduce"),
      }),
    });
    try {
      run();
    } finally {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: original,
      });
    }
  };

  it("animates the scroll", () => {
    const { pane, child, behaviors } = setup({
      target: { top: 450, height: 100 },
    });
    withMotion(false, () => revealInPane(pane, child));
    expect(behaviors).toEqual(["smooth"]);
  });

  it("jumps under reduced motion", () => {
    const { pane, child, behaviors } = setup({
      target: { top: 450, height: 100 },
    });
    withMotion(true, () => revealInPane(pane, child));
    expect(behaviors).toEqual(["instant"]);
  });
});

describe("focusInPlace", () => {
  it("focuses without scrolling", () => {
    const button = document.createElement("button");
    document.body.append(button);
    let options: FocusOptions | undefined;
    button.focus = (given) => {
      options = given;
    };
    focusInPlace(button);
    expect(options).toEqual({ preventScroll: true });
    button.remove();
  });

  it("does nothing without an element", () => {
    expect(() => focusInPlace(null)).not.toThrow();
  });
});
