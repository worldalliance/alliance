import { describe, expect, it } from "bun:test";
import { readLinkedSelection, selectionSearch } from "./linkedSelection";

describe("linked selection", () => {
  it("reads back the field and range a link carries", () => {
    const search = selectionSearch({
      field: "shortDescription",
      from: 6,
      to: 8,
    });
    expect(readLinkedSelection(new URLSearchParams(search))).toEqual({
      field: "shortDescription",
      from: 6,
      to: 8,
    });
  });

  it("ignores a link without a usable range", () => {
    expect(readLinkedSelection(new URLSearchParams("tab=details"))).toBeNull();
    expect(
      readLinkedSelection(new URLSearchParams("field=body&from=x&to=2")),
    ).toBeNull();
  });
});
