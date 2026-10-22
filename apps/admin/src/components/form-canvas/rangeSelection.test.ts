import type { PageItem } from "@alliance/common/forms/form-schema";
import {
  CanvasTargetKind,
  elementTarget,
  type ResolvedTarget,
} from "./canvasSelection";
import {
  CheckState,
  checkStateOf,
  extendSelection,
  toggleChecked,
} from "./rangeSelection";

const text = (id: string): PageItem => ({
  id,
  type: "input",
  kind: "text",
  label: id,
});
const fields = ["a", "b", "c", "d", "e"].map(text);

const element = (index: number): ResolvedTarget => ({
  kind: CanvasTargetKind.Element,
  index,
});
// Each id is a letter naming its position: a at 0, b at 1, and so on.
const at = (id: string) => ({ id, index: id.charCodeAt(0) - 97 });
const range = (anchor: string, focus: string) => ({
  kind: CanvasTargetKind.Range,
  anchor: at(anchor),
  focus: at(focus),
});
const extend = (selected: ResolvedTarget, start: number, end = start + 1) =>
  extendSelection({ fields, selected, clicked: { start, end } });

describe("extendSelection", () => {
  it("spans from the selected element to the clicked one, either way", () => {
    expect(extend(element(1), 3)).toEqual(range("b", "d"));
    expect(extend(element(3), 1)).toEqual(range("d", "b"));
  });

  it("keeps a range's anchor", () => {
    const selected: ResolvedTarget = {
      kind: CanvasTargetKind.Range,
      anchor: 3,
      start: 1,
      end: 4,
    };
    expect(extend(selected, 4)).toEqual(range("d", "e"));
    expect(extend(selected, 0)).toEqual(range("d", "a"));
  });

  it("anchors on a group's far end and takes in a clicked group whole", () => {
    const group: ResolvedTarget = {
      kind: CanvasTargetKind.Group,
      key: "g",
      start: 1,
      end: 3,
    };
    expect(extend(group, 0)).toEqual(range("c", "a"));
    expect(extend(element(0), 2, 4)).toEqual(range("a", "d"));
  });

  it("takes in the whole of a clicked group around the anchor", () => {
    expect(extend(element(2), 1, 4)).toEqual(range("b", "d"));
    expect(
      extend(
        { kind: CanvasTargetKind.Range, anchor: 2, start: 2, end: 5 },
        1,
        4,
      ),
    ).toEqual(range("b", "d"));
    expect(
      extend(
        { kind: CanvasTargetKind.Range, anchor: 3, start: 3, end: 5 },
        0,
        4,
      ),
    ).toEqual(range("d", "a"));
  });

  it("forms no range from the page, onto itself, or over an id-less end", () => {
    expect(extend({ kind: CanvasTargetKind.Page }, 1)).toBeNull();
    expect(extend(element(1), 1)).toBeNull();
    expect(
      extendSelection({
        fields: [text("a"), { type: "display", kind: "text", text: "No id" }],
        selected: element(0),
        clicked: { start: 1, end: 2 },
      }),
    ).toBeNull();
  });
});

describe("toggleChecked", () => {
  const span: ResolvedTarget = {
    kind: CanvasTargetKind.Range,
    anchor: 1,
    start: 1,
    end: 4,
  };
  const toggle = (selected: ResolvedTarget, index: number) =>
    toggleChecked({ fields, selected, index });

  it("locks the inside of a span, so unchecking can't split it", () => {
    expect(
      [0, 1, 2, 3, 4].map((index) =>
        checkStateOf({ fields, selected: span, index }),
      ),
    ).toEqual([
      CheckState.Unchecked,
      CheckState.Checked,
      CheckState.Locked,
      CheckState.Checked,
      CheckState.Unchecked,
    ]);
    expect(() => toggle(span, 2)).toThrow();
  });

  it("checks an element alone when nothing else is", () => {
    expect(toggle({ kind: CanvasTargetKind.Page }, 2)).toEqual(
      elementTarget(fields[2]!, 2),
    );
  });

  it("widens the selection to reach a checked element, its focus", () => {
    expect(toggle(element(0), 2)).toEqual(range("a", "c"));
    expect(toggle(span, 0)).toEqual(range("d", "a"));
  });

  it("drops an unchecked end, down to one element and then the page", () => {
    expect(toggle(span, 1)).toEqual(range("c", "d"));
    expect(toggle(span, 3)).toEqual(range("b", "c"));
    expect(
      toggle({ kind: CanvasTargetKind.Range, anchor: 0, start: 0, end: 2 }, 0),
    ).toEqual(elementTarget(fields[1]!, 1));
    expect(toggle(element(1), 1)).toEqual({ kind: CanvasTargetKind.Page });
  });

  it("locks an id-less block inside the span, dropping one left at an end", () => {
    const withLegacy: PageItem[] = [
      text("a"),
      text("b"),
      { type: "display", kind: "text", text: "No id" },
      text("d"),
    ];
    const all: ResolvedTarget = {
      kind: CanvasTargetKind.Range,
      anchor: 0,
      start: 0,
      end: 4,
    };
    expect(checkStateOf({ fields: withLegacy, selected: all, index: 2 })).toBe(
      CheckState.Locked,
    );
    expect(
      checkStateOf({ fields: withLegacy, selected: element(0), index: 2 }),
    ).toBe(CheckState.NoId);
    expect(
      checkStateOf({ fields: withLegacy, selected: element(2), index: 3 }),
    ).toBe(CheckState.BesideNoId);
    expect(
      toggleChecked({ fields: withLegacy, selected: all, index: 3 }),
    ).toEqual(range("a", "b"));
  });

  it("checks an id-less block alone with only the page selected", () => {
    const withLegacy: PageItem[] = [
      text("a"),
      { type: "display", kind: "text", text: "No id" },
    ];
    const page: ResolvedTarget = { kind: CanvasTargetKind.Page };
    expect(checkStateOf({ fields: withLegacy, selected: page, index: 1 })).toBe(
      CheckState.Unchecked,
    );
    expect(
      toggleChecked({ fields: withLegacy, selected: page, index: 1 }),
    ).toEqual(elementTarget(withLegacy[1]!, 1));
  });
});
