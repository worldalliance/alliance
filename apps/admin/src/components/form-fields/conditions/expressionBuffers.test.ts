import { expressionKeys, moveElementBuffers } from "./expressionBuffers";

const text = (value: string) => ({ text: value, formula: null });

describe("expressionKeys", () => {
  it("keeps ids holding a slash apart from the keys of what they contain", () => {
    const list = expressionKeys.within(expressionKeys.pageElements("p"), "a");
    const field = expressionKeys.within(
      expressionKeys.pageElements("p"),
      "a/b",
    );
    expect(expressionKeys.within(list, "b")).not.toBe(field);
  });

  it("keeps an escaped-looking id apart from the id it looks like", () => {
    const scope = expressionKeys.pageElements("p");
    expect(expressionKeys.within(scope, "a%2Fb")).not.toBe(
      expressionKeys.within(scope, "a/b"),
    );
  });

  it("keeps a page id holding a slash apart from an element on another page", () => {
    expect(
      expressionKeys.within(expressionKeys.pageElements("p/a"), "b"),
    ).not.toBe(
      expressionKeys.within(
        expressionKeys.within(expressionKeys.pageElements("p"), "a"),
        "b",
      ),
    );
  });

  it("takes any id, a lone surrogate included", () => {
    expect(expressionKeys.page("\uD800")).toBe("page:\uD800");
  });
});

describe("moveElementBuffers", () => {
  it("rekeys the moved elements and their contents under the new page", () => {
    expect(
      moveElementBuffers(
        {
          "element:p1/a": text("a"),
          "element:p1/a/sub": text("sub"),
          "element:p1/ab": text("ab"),
          "element:p1/b": text("b"),
          "page:p1": text("page"),
        },
        { from: "p1", to: "p2", ids: ["a"] },
      ),
    ).toEqual({
      "element:p2/a": text("a"),
      "element:p2/a/sub": text("sub"),
      "element:p1/ab": text("ab"),
      "element:p1/b": text("b"),
      "page:p1": text("page"),
    });
  });

  it("tells ids holding a slash apart from the contents of the ids they start with", () => {
    expect(
      moveElementBuffers(
        {
          "element:p1/a%2Fb": text("a/b"),
          "element:p1/c/d": text("c's d"),
          "element:p1/c%2Fd": text("c/d"),
        },
        { from: "p1", to: "p2", ids: ["a/b", "c"] },
      ),
    ).toEqual({
      "element:p2/a%2Fb": text("a/b"),
      "element:p2/c/d": text("c's d"),
      "element:p1/c%2Fd": text("c/d"),
    });
  });

  it("leaves the text of a page whose id starts with the moved element's key", () => {
    expect(
      moveElementBuffers(
        { "element:p1%2Fa/b": text("b") },
        { from: "p1", to: "p2", ids: ["a"] },
      ),
    ).toEqual({ "element:p1%2Fa/b": text("b") });
  });

  it("drops text the new page held under the moved elements' keys", () => {
    expect(
      moveElementBuffers(
        {
          "element:p1/a": text("new"),
          "element:p2/a": text("stale"),
          "element:p2/b/sub": text("stale"),
          "element:p2/c": text("kept"),
        },
        { from: "p1", to: "p2", ids: ["a", "b"] },
      ),
    ).toEqual({ "element:p2/a": text("new"), "element:p2/c": text("kept") });
  });
});
