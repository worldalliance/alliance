import { getMaxSelections } from "./multiselect";

describe("getMaxSelections", () => {
  it("returns a positive cap", () => {
    expect(getMaxSelections({ maxSelections: 2 })).toBe(2);
  });

  it.each([undefined, 0, -1])("treats %p as no cap", (maxSelections) => {
    expect(getMaxSelections({ maxSelections })).toBeUndefined();
  });
});
