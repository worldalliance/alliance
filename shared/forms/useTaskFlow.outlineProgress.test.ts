import { act } from "@testing-library/react";
import { header, input, setup } from "./useTaskFlow.testing";

const doneSteps = (outline: { heading: string; done: boolean }[] | null) =>
  outline?.filter(({ done }) => done).map(({ heading }) => heading);

describe("useTaskFlow outline progress", () => {
  it("marks no step done before the member starts", () => {
    const { hook } = setup();
    expect(doneSteps(hook.result.current.outline)).toEqual([]);
  });

  it("marks the steps before the member's saved screen done", () => {
    const { hook } = setup({ savedScreen: 2 });
    expect(doneSteps(hook.result.current.outline)).toEqual(["h"]);
  });

  it("falls back to the draft's page when no screen is saved", () => {
    const { hook } = setup({ currentPageIndex: 2 });
    expect(doneSteps(hook.result.current.outline)).toEqual(["h"]);
  });

  it("marks the steps before the screen Begin opens when the saved one is hidden", () => {
    const { hook } = setup({
      savedScreen: 0,
      visiblePageIndices: [1, 2],
      currentPageIndex: 2,
    });
    expect(doneSteps(hook.result.current.outline)).toEqual(["h"]);
    act(() => hook.result.current.begin());
    expect(hook.result.current.screenIndex).toBe(2);
  });

  it("is pending until the saved screen loads", () => {
    const { hook, params } = setup({ savedScreen: 2, positionLoaded: false });
    expect(hook.result.current.outline).toBeNull();

    params.position = { ...params.position, loaded: true };
    act(() => hook.rerender());
    expect(doneSteps(hook.result.current.outline)).toEqual(["h"]);
  });

  it("marks a step spanning several pages done only past its last page", () => {
    const schema = {
      pages: [
        { id: "p1", fields: [header("Your story"), input("a")] },
        { id: "p2", fields: [header("Your story"), input("b")] },
        { id: "p3", fields: [header("Pick a date"), input("c")] },
      ],
      outputViews: [],
    };
    const midway = setup({ schema, savedScreen: 1 });
    expect(doneSteps(midway.hook.result.current.outline)).toEqual([]);
    const past = setup({ schema, savedScreen: 2 });
    expect(doneSteps(past.hook.result.current.outline)).toEqual(["Your story"]);
  });

  it("is empty when the form turns the outline off", () => {
    const { hook } = setup({
      schema: {
        pages: [{ id: "p1", fields: [header("h"), input("a")] }],
        outputViews: [],
        taskOutline: false,
      },
      visiblePageIndices: [0],
    });
    expect(hook.result.current.outline).toEqual([]);
  });
});
