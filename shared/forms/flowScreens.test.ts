import type {
  DisplayBlock,
  HeaderBlock,
} from "@alliance/common/forms/display-blocks";
import type {
  AnyField,
  FormSchema,
  Page,
  PageItem,
} from "@alliance/common/forms/form-schema";
import { taskFlowFallbackTitle } from "../lib/copy";
import {
  backgroundScreenIndex,
  buildFlowScreens,
  flowProgress,
  flowResumeIndex,
  flowScreenTitle,
  splitBackground,
  visibleFlowScreenIndices,
  withoutEmptySections,
  type FlowScreen,
} from "./flowScreens";

const input = (id: string): AnyField => ({
  id,
  type: "input",
  kind: "textarea",
  label: id,
});
const header = (id: string): HeaderBlock => ({
  id,
  type: "display",
  kind: "header",
  text: id,
});
const text = (id: string): DisplayBlock => ({
  id,
  type: "display",
  kind: "text",
  text: id,
});

const schemaOf = (...pages: Page[]): FormSchema => ({
  pages,
  outputViews: [],
});
const page = (id: string, fields: PageItem[], title?: string): Page => ({
  id,
  title,
  fields,
});

const ids = (schema: FormSchema) =>
  buildFlowScreens(schema).map((screen) => [
    ...(screen.heading ? [`# ${screen.heading.id}`] : []),
    ...screen.elements.map((element) => element.id),
  ]);

describe("buildFlowScreens", () => {
  it("makes one screen per page", () => {
    const screens = buildFlowScreens(
      schemaOf(page("p1", [text("a")]), page("p2", [input("q")])),
    );
    expect(screens).toEqual([
      { pageIndex: 0, heading: null, elements: [text("a")] },
      { pageIndex: 1, heading: null, elements: [input("q")] },
    ]);
  });

  it("keeps a page's headers and inputs on one screen", () => {
    expect(
      ids(
        schemaOf(
          page("p1", [
            header("h1"),
            input("q1"),
            header("h2"),
            input("q2"),
            input("q3"),
          ]),
        ),
      ),
    ).toEqual([["# h1", "q1", "h2", "q2", "q3"]]);
  });

  it("titles a screen with the page's first header, wherever it sits", () => {
    expect(
      ids(schemaOf(page("p1", [text("a"), header("h"), input("q")]))),
    ).toEqual([["# h", "a", "q"]]);
  });

  it("keeps a page that holds only a header", () => {
    expect(ids(schemaOf(page("p1", [header("h")])))).toEqual([["# h"]]);
  });

  it("keeps an empty page, so screens line up with pages", () => {
    expect(ids(schemaOf(page("p1", []), page("p2", [text("a")])))).toEqual([
      [],
      ["a"],
    ]);
  });
});

describe("withoutEmptySections", () => {
  const elements = [
    input("q"),
    header("plan"),
    text("plan-text"),
    input("plan-q"),
    header("end"),
  ];
  const shownIds = (hidden: string[]) =>
    withoutEmptySections(
      elements,
      (element) => !hidden.some((id) => id === element.id),
    ).map((element) => element.id);

  it("drops a header once everything under it is hidden", () => {
    expect(shownIds(["plan-text", "plan-q"])).toEqual([
      "q",
      "plan-text",
      "plan-q",
      "end",
    ]);
  });

  it("keeps a header while anything under it shows", () => {
    expect(shownIds(["plan-text"])).toEqual(elements.map(({ id }) => id));
  });

  it("keeps a header with nothing under it", () => {
    expect(shownIds([])).toContain("end");
  });
});

describe("visibleFlowScreenIndices", () => {
  const screens = buildFlowScreens(
    schemaOf(
      page("p1", [header("h1"), text("a")]),
      page("p2", [header("h2"), text("b")]),
      page("p3", [input("q")]),
    ),
  );

  it("skips screens on hidden pages", () => {
    expect(
      visibleFlowScreenIndices({
        screens,
        visiblePageIndices: [0, 2],
        isElementVisible: () => true,
      }),
    ).toEqual([0, 2]);
  });

  it("skips an empty page", () => {
    expect(
      visibleFlowScreenIndices({
        screens: buildFlowScreens(
          schemaOf(page("p1", []), page("p2", [text("a")])),
        ),
        visiblePageIndices: [0, 1],
        isElementVisible: () => true,
      }),
    ).toEqual([1]);
  });

  it("shows a header-only screen while its header shows", () => {
    const headerOnly = buildFlowScreens(schemaOf(page("p1", [header("h")])));
    const visible = (shown: boolean) =>
      visibleFlowScreenIndices({
        screens: headerOnly,
        visiblePageIndices: [0],
        isElementVisible: () => shown,
      });
    expect(visible(true)).toEqual([0]);
    expect(visible(false)).toEqual([]);
  });

  it("skips a screen whose only showing block heads a hidden section", () => {
    expect(
      visibleFlowScreenIndices({
        screens: buildFlowScreens(
          schemaOf(page("p1", [header("h"), header("sub"), text("a")])),
        ),
        visiblePageIndices: [0],
        isElementVisible: (element) => element.id !== "a",
      }),
    ).toEqual([]);
  });

  it("skips screens whose elements are all hidden", () => {
    expect(
      visibleFlowScreenIndices({
        screens,
        visiblePageIndices: [0, 1, 2],
        isElementVisible: (element) => element.id !== "b",
      }),
    ).toEqual([0, 2]);
  });
});

describe("flowResumeIndex", () => {
  const screens = buildFlowScreens(
    schemaOf(
      page("p1", [text("a")]),
      page("p2", [text("b")]),
      page("p3", [text("c")]),
    ),
  );

  it("resumes at the first visible screen on or after the draft's page", () => {
    expect(
      flowResumeIndex({ screens, visibleIndices: [0, 2], pageIndex: 1 }),
    ).toBe(2);
  });

  it("falls back to the first visible screen", () => {
    expect(
      flowResumeIndex({ screens, visibleIndices: [1], pageIndex: 2 }),
    ).toBe(1);
  });

  it("is null when no screen is visible", () => {
    expect(
      flowResumeIndex({ screens, visibleIndices: [], pageIndex: 0 }),
    ).toBeNull();
  });
});

describe("flowProgress", () => {
  it("counts the screens finished before the current one", () => {
    expect(flowProgress({ visibleIndices: [0, 2, 3, 5], screenIndex: 3 })).toBe(
      50,
    );
  });

  it("is zero with nothing visible", () => {
    expect(flowProgress({ visibleIndices: [], screenIndex: 0 })).toBe(0);
  });
});

describe("backgroundScreenIndex", () => {
  const screens = buildFlowScreens(
    schemaOf(
      page("p1", [text("a")]),
      page("p2", [header("h"), input("q")]),
      page("p3", [text("b")]),
    ),
  );

  const background = (
    visibleIndices: number[],
    isElementVisible: (element: PageItem) => boolean = () => true,
  ) => backgroundScreenIndex({ screens, visibleIndices, isElementVisible });

  it("is the first visible screen when it has no inputs", () => {
    expect(background([0, 1, 2])).toBe(0);
  });

  it("is null when the first visible screen asks for input", () => {
    expect(background([1, 2])).toBeNull();
  });

  it("is the first visible screen when its questions are hidden", () => {
    expect(background([1, 2], (element) => element.id !== "q")).toBe(1);
  });
});

describe("flowScreenTitle", () => {
  const title = (screen: FlowScreen, visible = true) =>
    flowScreenTitle({
      screen,
      activeUserKey: undefined,
      isElementCurrentlyVisible: () => visible,
      variableValues: new Map(),
    });

  it("uses the screen's header", () => {
    expect(
      title({ pageIndex: 0, heading: header("Rate it"), elements: [] }),
    ).toBe("Rate it");
  });

  it("falls back by whether the screen asks for anything", () => {
    expect(title({ pageIndex: 0, heading: null, elements: [input("q")] })).toBe(
      taskFlowFallbackTitle.questions,
    );
    expect(
      title(
        { pageIndex: 0, heading: header("h"), elements: [text("a")] },
        false,
      ),
    ).toBe(taskFlowFallbackTitle.reading);
  });

  it("reads as reading when the screen's questions are hidden", () => {
    expect(
      flowScreenTitle({
        screen: {
          pageIndex: 0,
          heading: null,
          elements: [text("a"), input("q")],
        },
        activeUserKey: undefined,
        isElementCurrentlyVisible: (element) => element.id !== "q",
        variableValues: new Map(),
      }),
    ).toBe(taskFlowFallbackTitle.reading);
  });
});

describe("splitBackground", () => {
  it("puts media ahead of the text it came with", () => {
    const video: DisplayBlock = {
      id: "v",
      type: "display",
      kind: "video",
      src: "https://example.com/v.mp4",
    };
    expect(splitBackground([text("a"), video, text("b")])).toEqual({
      media: [video],
      reading: [text("a"), text("b")],
    });
  });
});
