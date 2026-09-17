import { renderFieldEditor } from "./fieldEditors";

describe("renderFieldEditor", () => {
  it("names a field kind it has no editor for", () => {
    const field = { kind: "signature", id: "f", type: "input", label: null };
    expect(() =>
      // @ts-expect-error a kind outside the schema
      renderFieldEditor({ field, onUpdate() {}, onRemove() {} }),
    ).toThrow("no editor for field kind signature");
  });
});
