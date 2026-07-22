import { joinNames, nameListSeparator } from "./nameList";

describe("joinNames", () => {
  it("returns empty for no names", () => {
    expect(joinNames([])).toBe("");
  });

  it("returns a lone name as-is", () => {
    expect(joinNames(["Ada"])).toBe("Ada");
  });

  it("joins two names with a bare and", () => {
    expect(joinNames(["Ada", "Grace"])).toBe("Ada and Grace");
  });

  it("joins three or more names with Oxford commas", () => {
    expect(joinNames(["Ada", "Grace", "Edsger"])).toBe(
      "Ada, Grace, and Edsger",
    );
    expect(joinNames(["Ada", "Grace", "Edsger", "Barbara"])).toBe(
      "Ada, Grace, Edsger, and Barbara",
    );
  });
});

describe("nameListSeparator", () => {
  it("is empty after the last item", () => {
    expect(nameListSeparator(0, 1)).toBe("");
    expect(nameListSeparator(2, 3)).toBe("");
  });
});
