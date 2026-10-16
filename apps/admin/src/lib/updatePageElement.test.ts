import type { Page } from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import { updatePageElement } from "./updatePageElement";

const equals = (value: string): VisibleIfFormula => ({
  conditions: { c1: { kind: "equals", when: "ctrl", equals: value } },
  formula: "c1",
});

const pages = (value: string): Page[] => [
  {
    id: "p0",
    fields: [
      {
        id: "earlier",
        type: "input",
        kind: "text",
        label: "Earlier",
        visibleIfFormula: equals(value),
      },
    ],
  },
  {
    id: "p1",
    fields: [
      {
        id: "ctrl",
        type: "input",
        kind: "radio",
        label: "Ctrl",
        options: [{ label: "Alpha", value }],
      },
    ],
  },
  {
    id: "p2",
    visibleIfFormula: equals(value),
    fields: [
      {
        id: "later",
        type: "input",
        kind: "text",
        label: "Later",
        visibleIfFormula: equals(value),
      },
    ],
  },
];

describe("updatePageElement", () => {
  it("carries an option value rename into later pages' conditions", () => {
    const next = updatePageElement({
      pages: pages("alpha"),
      pageIndex: 1,
      index: 0,
      updates: { options: [{ label: "Alpha", value: "beta" }] },
    });

    const renamed = pages("beta");
    expect(next[1]).toEqual(renamed[1]);
    expect(next[2]).toEqual(renamed[2]);
    expect(next[0]).toEqual(pages("alpha")[0]);
  });

  it("leaves the pages as they are when no element is at the index", () => {
    const before = pages("alpha");
    expect(
      updatePageElement({
        pages: before,
        pageIndex: 1,
        index: 5,
        updates: { label: "Gone" },
      }),
    ).toBe(before);
  });
});
