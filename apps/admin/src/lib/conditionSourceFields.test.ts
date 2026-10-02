import type { DisplayBlock } from "@alliance/common/forms/display-blocks";
import type { Page, TextField } from "@alliance/common/forms/form-schema";
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
const pages: Page[] = [
  { id: "p1", fields: [text("earlier-page")] },
  { id: "p2", fields: [text("a"), text("b"), label, text("c")] },
  { id: "p3", fields: [text("later-page")] },
];

const ids = (fields: { id: string }[]) => fields.map((f) => f.id);

describe("conditionSourceFields", () => {
  it("splits the form's fields at the item's position, leaving it out", () => {
    const result = conditionSourceFields({ pages, pageIndex: 1, index: 1 });
    expect(ids(result.previousFields)).toEqual(["earlier-page", "a"]);
    expect(ids(result.laterFields)).toEqual(["c"]);
  });
});
