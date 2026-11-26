import { renderBlockEditor } from "./blockEditors";

describe("renderBlockEditor", () => {
  it("names a block kind it has no editor for", () => {
    const block = { kind: "marquee", id: "b", type: "display" };
    expect(() =>
      // @ts-expect-error a kind outside the schema
      renderBlockEditor({ block, onUpdate() {}, onRemove() {} }),
    ).toThrow("no editor for block kind marquee");
  });
});
