import { EditableNestedBlock } from "./EditableNestedBlock";

const block = { kind: "marquee", id: "b", type: "display" };

describe("EditableNestedBlock", () => {
  it("names a nested block kind it has no editor for", () => {
    expect(() =>
      // @ts-expect-error a kind outside the schema
      EditableNestedBlock({ block, onChange() {}, onRemove() {} }),
    ).toThrow("no editor for nested block kind marquee");
  });
});
