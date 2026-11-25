import { renderHook } from "@testing-library/react";
import { TASK_FLOW_ORIGIN, useExpandingPanel } from "./useExpandingPanel";

const prefersReducedMotion = (matches: boolean) =>
  jest.spyOn(window, "matchMedia").mockReturnValue(
    Object.assign(new EventTarget(), {
      matches,
      media: "",
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
    }),
  );

const placed = <T extends HTMLElement>(
  element: T,
  rect: { top: number; right: number; bottom: number; left: number },
) => {
  element.getBoundingClientRect = () =>
    DOMRect.fromRect({
      x: rect.left,
      y: rect.top,
      width: rect.right - rect.left,
      height: rect.bottom - rect.top,
    });
  return element;
};

function setup() {
  const origin = placed(document.createElement("div"), {
    top: 100,
    right: 500,
    bottom: 300,
    left: 80,
  });
  origin.className = TASK_FLOW_ORIGIN;
  const anchor = document.createElement("div");
  origin.append(anchor);
  const panel = placed(document.createElement("div"), {
    top: 50,
    right: 1000,
    bottom: 800,
    left: 60,
  });
  const hook = renderHook(() => useExpandingPanel({ current: anchor }));
  return { hook, panel };
}

beforeEach(() =>
  jest.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0),
);
afterEach(() => jest.restoreAllMocks());

it("opens the panel out of its container and collapses back into it", () => {
  prefersReducedMotion(false);
  const { hook, panel } = setup();
  const measure = panel.getBoundingClientRect;
  const clipsAtLayout: string[] = [];
  panel.getBoundingClientRect = () => {
    clipsAtLayout.push(`${panel.style.clipPath} / ${panel.style.transition}`);
    return measure();
  };

  hook.result.current.panelRef(panel);
  expect(clipsAtLayout.at(-1)).toBe(
    "inset(50px 500px 500px 20px round 6px) / none",
  );
  expect(panel.style.clipPath).toBe("inset(0px round 0px)");
  expect(panel.style.transition).toContain("clip-path");

  void hook.result.current.collapse();
  expect(panel.style.clipPath).toBe("inset(50px 500px 500px 20px round 6px)");
  expect(panel.style.opacity).toBe("0");
});

it("leaves the panel alone under reduced motion", async () => {
  prefersReducedMotion(true);
  const { hook, panel } = setup();

  hook.result.current.panelRef(panel);
  await hook.result.current.collapse();
  expect(panel.style.clipPath).toBe("");
  expect(panel.style.opacity).toBe("");
});
