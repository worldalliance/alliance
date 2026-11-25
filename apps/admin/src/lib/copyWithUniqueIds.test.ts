import type {
  FormSchema,
  ListField,
  Page,
} from "@alliance/common/forms/form-schema";
import type { VisibleIfFormula } from "@alliance/common/forms/visible-if-formula";
import {
  copyElementWithUniqueIds,
  copyPageWithUniqueIds,
} from "./copyWithUniqueIds";

const shownWhen = (when: string): VisibleIfFormula => ({
  conditions: { c1: { kind: "hasValue", when, hasValue: true } },
  formula: "c1",
});

const page: Page = {
  id: "page-a",
  title: "Intro",
  fields: [
    { id: "name", type: "input", kind: "text", label: "Name" },
    {
      id: "greeting",
      type: "input",
      kind: "text",
      label: "Greeting",
      visibleIfFormula: shownWhen("name"),
    },
    {
      id: "aside",
      type: "input",
      kind: "text",
      label: "Aside",
      visibleIfFormula: shownWhen("elsewhere"),
    },
  ],
};

const list: ListField = {
  id: "people",
  type: "input",
  kind: "list",
  label: "People",
  defaultNumber: 0,
  min: 0,
  fields: [{ id: "person", type: "input", kind: "email", label: "Email" }],
  outputViewHiddenFieldIds: ["person"],
  visibleIfFormula: shownWhen("name"),
};

const schema: FormSchema = {
  pages: [page, { id: "page-b", fields: [list] }],
  outputViews: [],
  aggregateViews: [],
};

describe("copyPageWithUniqueIds", () => {
  it("gives the copy fresh ids and points its conditions at the copies", () => {
    const copy = copyPageWithUniqueIds(page, schema);
    const [name, greeting, aside] = copy.fields;

    expect(copy.title).toBe("Intro (Copy)");
    expect(copy.id).not.toBe(page.id);
    expect(name!.id).not.toBe("name");
    expect(greeting!.visibleIfFormula).toEqual(shownWhen(name!.id!));
    expect(aside!.visibleIfFormula).toEqual(shownWhen("elsewhere"));
  });
});

describe("copyElementWithUniqueIds", () => {
  it("renames a list and its sub-fields, keeping references outside it", () => {
    const copy = copyElementWithUniqueIds(list, schema);
    if (copy.kind !== "list") throw new Error("expected a list");
    const subId = copy.fields[0]!.id;

    expect(copy.id).not.toBe(list.id);
    expect(subId).not.toBe("person");
    expect(copy.outputViewHiddenFieldIds).toEqual([subId]);
    expect(copy.visibleIfFormula).toEqual(shownWhen("name"));
  });
});
