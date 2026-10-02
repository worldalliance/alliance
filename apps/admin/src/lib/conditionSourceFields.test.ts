import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import type {
  FieldGroup,
  Page,
  TextField,
} from "@alliance/common/forms/form-schema";
import { conditionSourceFields } from "./conditionSourceFields";

const text = (id: string): TextField => ({
  id,
  type: "input",
  kind: "text",
  label: id,
});
const label: DisplayBlock = {
  id: "label",
  type: "display",
  kind: "label",
  text: "",
};
const group: FieldGroup = {
  id: "g",
  type: "group",
  kind: "group",
  fields: [text("g1"), text("g2"), text("g3")],
};
const pages: Page[] = [
  { id: "p1", fields: [text("earlier-page")] },
  { id: "p2", fields: [text("a"), group, label, text("b")] },
  { id: "p3", fields: [text("later-page")] },
];

const ids = (fields: { id: string }[]) => fields.map((f) => f.id);

describe("conditionSourceFields", () => {
  it("splits a top-level item's fields at its position on the page", () => {
    const result = conditionSourceFields({
      pages,
      pageIndex: 1,
      parentId: null,
      index: 0,
    });
    expect(ids(result.previousFields)).toEqual(["earlier-page"]);
    expect(ids(result.laterFields)).toEqual(["g1", "g2", "g3", "b"]);
  });

  it("leaves a group's own children out of its sources", () => {
    const result = conditionSourceFields({
      pages,
      pageIndex: 1,
      parentId: null,
      index: 1,
    });
    expect(ids(result.previousFields)).toEqual(["earlier-page", "a"]);
    expect(ids(result.laterFields)).toEqual(["b"]);
  });

  it("gives a group child its later siblings, then the rest of the page", () => {
    const result = conditionSourceFields({
      pages,
      pageIndex: 1,
      parentId: "g",
      index: 1,
    });
    expect(ids(result.previousFields)).toEqual(["earlier-page", "a", "g1"]);
    expect(ids(result.laterFields)).toEqual(["g3", "b"]);
  });
});
