import { expressionKeys } from "./expressionBuffers";

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
