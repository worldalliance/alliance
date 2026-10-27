import type { AnyField } from "@alliance/common/forms/form-schema";
import { R } from "@alliance/common/result";
import {
  applyDefaultValues,
  clampPageIndex,
  readStoredFormDraft,
  restorableAnswers,
  serializeStoredFormDraft,
} from "./formDrafts";

describe("restorableAnswers", () => {
  it("drops multiselect selections of options the field no longer has", () => {
    const places: AnyField = {
      id: "places",
      type: "input",
      kind: "multiselect",
      label: "Places",
      options: [{ label: "New York", value: "ny" }],
    };
    expect(
      restorableAnswers(
        { places: ["gone", "ny"] },
        new Map([["places", places]]),
      ),
    ).toEqual({ places: ["ny"] });
  });

  it("keeps a cleared multiselect from taking its default", () => {
    const places: AnyField = {
      id: "places",
      type: "input",
      kind: "multiselect",
      label: "Places",
      options: [{ label: "New York", value: "ny" }],
      defaultValue: ["ny"],
    };
    const restored = restorableAnswers(
      { places: [] },
      new Map([["places", places]]),
    );
    expect(applyDefaultValues(restored, new Map([["places", ["ny"]]]))).toEqual(
      { places: [] },
    );
  });
});

describe("readStoredFormDraft", () => {
  const name: AnyField = {
    id: "name",
    type: "input",
    kind: "text",
    label: "Name",
  };
  const read = (raw: string) =>
    readStoredFormDraft({
      raw,
      fieldLookup: new Map([["name", name]]),
      outputFieldIds: new Set(["name"]),
    });

  it("round-trips what serializeStoredFormDraft writes", () => {
    const raw = serializeStoredFormDraft({
      formData: { name: "Ada", gone: "x" },
      publicAnswers: { name: true, gone: false },
      currentPageIndex: 2,
      syncedUpdatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(read(raw)).toEqual(
      R.success({
        answers: { name: "Ada" },
        publicAnswers: { name: true },
        currentPageIndex: 2,
        syncedUpdatedAt: "2026-01-01T00:00:00.000Z",
      }),
    );
  });

  it("drops a mistyped field and keeps the rest", () => {
    expect(
      read(
        JSON.stringify({
          formData: "oops",
          publicAnswers: { name: "yes" },
          currentPageIndex: "1",
          syncedUpdatedAt: null,
        }),
      ),
    ).toEqual(
      R.success({
        answers: undefined,
        publicAnswers: {},
        currentPageIndex: undefined,
        syncedUpdatedAt: undefined,
      }),
    );
  });

  it("fails on unparseable JSON and non-objects", () => {
    expect(read("{").ok).toBe(false);
    expect(read("null").ok).toBe(false);
  });
});

describe("clampPageIndex", () => {
  it("floors the index and keeps it within the form's pages", () => {
    expect(clampPageIndex(1.7, 3)).toBe(1);
    expect(clampPageIndex(-2, 3)).toBe(0);
    expect(clampPageIndex(9, 3)).toBe(3);
    expect(clampPageIndex(Number.NaN, 3)).toBe(0);
  });
});
