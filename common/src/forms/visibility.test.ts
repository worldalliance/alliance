import type { Page, TextField } from "./form-schema";
import { isPageCurrentlyVisible, stripHiddenAnswers } from "./visibility";
import type { Condition, VisibleIfFormula } from "./visible-if-formula";

const formula = (conditions: Record<string, Condition>): VisibleIfFormula => ({
  conditions,
  formula: Object.keys(conditions)[0] ?? "",
});

const textField = (
  id: string,
  overrides: Partial<TextField> = {},
): TextField => ({
  id,
  type: "input",
  kind: "text",
  label: id,
  ...overrides,
});

const page = (id: string, overrides: Partial<Page> = {}): Page => ({
  id,
  fields: [],
  ...overrides,
});

const extras = { deviceType: "desktop" as const };

describe("isPageCurrentlyVisible", () => {
  const conditionalPage = page("p2", {
    fields: [textField("f2")],
    visibleIfFormula: formula({
      c1: { kind: "equals", when: "f1", equals: "yes" },
    }),
  });

  it("is visible without a formula", () => {
    expect(isPageCurrentlyVisible(page("p1"), {}, extras)).toBe(true);
  });

  it("is visible with an empty formula", () => {
    expect(
      isPageCurrentlyVisible(
        page("p1", { visibleIfFormula: formula({}) }),
        {},
        extras,
      ),
    ).toBe(true);
  });

  it("evaluates the formula against answers", () => {
    expect(isPageCurrentlyVisible(conditionalPage, { f1: "yes" }, extras)).toBe(
      true,
    );
    expect(isPageCurrentlyVisible(conditionalPage, { f1: "no" }, extras)).toBe(
      false,
    );
  });

  it("stays hidden in readOnly when the page has no answers", () => {
    expect(
      isPageCurrentlyVisible(
        conditionalPage,
        { f1: "no" },
        { ...extras, readOnly: true },
      ),
    ).toBe(false);
  });

  it("stays visible in readOnly when a field on the page was answered", () => {
    // Conditions don't always replay when reviewing a completed response
    // (e.g. validator results missing from older submissions), so an answered
    // page must never be hidden.
    expect(
      isPageCurrentlyVisible(
        conditionalPage,
        { f1: "no", f2: "answered" },
        { ...extras, readOnly: true },
      ),
    ).toBe(true);
  });
});

describe("firstContractSigned condition", () => {
  const signedPage = (
    comparison: "before" | "onOrAfter",
    date = "2026-01-01T00:00:00.000Z",
  ): Page =>
    page("p1", {
      fields: [textField("f1")],
      visibleIfFormula: formula({
        c1: { kind: "firstContractSigned", comparison, date },
      }),
    });

  it("compares the first signing date against the threshold", () => {
    const early = {
      ...extras,
      firstContractSignedAt: "2025-06-15T12:00:00.000Z",
    };
    const late = {
      ...extras,
      firstContractSignedAt: "2026-03-01T00:00:00.000Z",
    };

    expect(isPageCurrentlyVisible(signedPage("before"), {}, early)).toBe(true);
    expect(isPageCurrentlyVisible(signedPage("before"), {}, late)).toBe(false);
    expect(isPageCurrentlyVisible(signedPage("onOrAfter"), {}, early)).toBe(
      false,
    );
    expect(isPageCurrentlyVisible(signedPage("onOrAfter"), {}, late)).toBe(
      true,
    );
  });

  it("treats a signing at exactly the threshold as onOrAfter", () => {
    const atThreshold = {
      ...extras,
      firstContractSignedAt: "2026-01-01T00:00:00.000Z",
    };
    expect(
      isPageCurrentlyVisible(signedPage("onOrAfter"), {}, atThreshold),
    ).toBe(true);
    expect(isPageCurrentlyVisible(signedPage("before"), {}, atThreshold)).toBe(
      false,
    );
  });

  it("fails both comparisons when the user has never signed", () => {
    expect(isPageCurrentlyVisible(signedPage("before"), {}, extras)).toBe(
      false,
    );
    expect(isPageCurrentlyVisible(signedPage("onOrAfter"), {}, extras)).toBe(
      false,
    );
    const explicitNull = { ...extras, firstContractSignedAt: null };
    expect(isPageCurrentlyVisible(signedPage("before"), {}, explicitNull)).toBe(
      false,
    );
  });

  it("fails when either datetime is unparseable", () => {
    const garbageSignedAt = { ...extras, firstContractSignedAt: "not-a-date" };
    expect(
      isPageCurrentlyVisible(signedPage("before"), {}, garbageSignedAt),
    ).toBe(false);
    const valid = {
      ...extras,
      firstContractSignedAt: "2025-06-15T12:00:00.000Z",
    };
    expect(
      isPageCurrentlyVisible(signedPage("before", "not-a-date"), {}, valid),
    ).toBe(false);
  });
});

describe("stripHiddenAnswers", () => {
  const equalsYes = (when: string): Condition => ({
    kind: "equals",
    when,
    equals: "yes",
  });

  it("returns the same object when every answered field is visible", () => {
    const pages = [page("p1", { fields: [textField("f1"), textField("f2")] })];
    const answers = { f1: "yes", f2: "hello" };
    expect(stripHiddenAnswers(pages, answers, extras)).toBe(answers);
  });

  it("strips the answer of a field hidden by its own formula", () => {
    const pages = [
      page("p1", {
        fields: [
          textField("f1"),
          textField("f2", {
            visibleIfFormula: formula({ c1: equalsYes("f1") }),
          }),
        ],
      }),
    ];
    expect(
      stripHiddenAnswers(pages, { f1: "no", f2: "stale" }, extras),
    ).toEqual({ f1: "no" });
  });

  it("strips all answers on a hidden page", () => {
    const pages = [
      page("p1", { fields: [textField("f1")] }),
      page("p2", {
        fields: [textField("f2"), textField("f3")],
        visibleIfFormula: formula({ c1: equalsYes("f1") }),
      }),
    ];
    expect(
      stripHiddenAnswers(pages, { f1: "no", f2: "stale", f3: "stale" }, extras),
    ).toEqual({ f1: "no" });
  });

  it("cascades: a stripped answer hides pages that depended on it", () => {
    // f1 = "no" hides page 2, so f2's stale "yes" must not keep page 3
    // visible; both f2 and f3 get stripped.
    const pages = [
      page("p1", { fields: [textField("f1")] }),
      page("p2", {
        fields: [textField("f2")],
        visibleIfFormula: formula({ c1: equalsYes("f1") }),
      }),
      page("p3", {
        fields: [textField("f3")],
        visibleIfFormula: formula({ c1: equalsYes("f2") }),
      }),
    ];
    expect(
      stripHiddenAnswers(pages, { f1: "no", f2: "yes", f3: "kept?" }, extras),
    ).toEqual({ f1: "no" });
  });

  it("leaves keys that belong to no question field untouched", () => {
    const pages = [page("p1", { fields: [textField("f1")] })];
    expect(
      stripHiddenAnswers(pages, { f1: "yes", legacy: "keep" }, extras),
    ).toEqual({ f1: "yes", legacy: "keep" });
  });

  it("does not strip answered fields in readOnly", () => {
    // Mirrors the readOnly fallbacks: reviewing a completed response must
    // never drop answers, even when conditions no longer replay as true.
    const pages = [
      page("p1", { fields: [textField("f1")] }),
      page("p2", {
        fields: [textField("f2")],
        visibleIfFormula: formula({ c1: equalsYes("f1") }),
      }),
    ];
    const answers = { f1: "no", f2: "answered" };
    expect(
      stripHiddenAnswers(pages, answers, { ...extras, readOnly: true }),
    ).toBe(answers);
  });
});
