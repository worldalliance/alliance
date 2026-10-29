import { afterMotion, flowMotion, transition } from "./flowMotion";

it("turns a flow motion into a CSS transition for each property", () => {
  expect(transition(flowMotion.recolor, "color", "opacity")).toBe(
    "color 200ms cubic-bezier(0.25, 1, 0.5, 1), opacity 200ms cubic-bezier(0.25, 1, 0.5, 1)",
  );
});

describe("afterMotion", () => {
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
  const settled = (promise: Promise<void>) => {
    let done = false;
    void promise.then(() => (done = true));
    return () => done;
  };

  afterEach(() => jest.restoreAllMocks());

  it("resolves at once under reduced motion", async () => {
    prefersReducedMotion(true);
    const done = settled(afterMotion(flowMotion.expand));
    await Promise.resolve();
    expect(done()).toBe(true);
  });

  it("waits two frames and then the longest motion", async () => {
    prefersReducedMotion(false);
    const frames = jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0);
        return 0;
      });
    const delays: (number | undefined)[] = [];
    const runNow = globalThis.setTimeout;
    jest.spyOn(window, "setTimeout").mockImplementation((handler, delay) => {
      delays.push(delay);
      return runNow(handler, 0);
    });

    await afterMotion(flowMotion.collapse, flowMotion.expand);
    expect(frames).toHaveBeenCalledTimes(2);
    expect(delays).toEqual([flowMotion.expand.durationMs]);
  });
});
