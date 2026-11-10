import type { DisplayBlock } from "./display-blocks";
import type { FormSchema } from "./form-schema";
import { schemaWithMemberContent } from "./member-content";

const greeting: DisplayBlock = {
  id: "greeting",
  type: "display",
  kind: "text",
  text: "Hello",
  manualPerUser: true,
  manualUserContent: { "7": { text: "Dear Ana" }, "9": { text: "Dear Cy" } },
};

const form: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        greeting,
        { id: "name", type: "input", kind: "text", label: "Name" },
      ],
    },
  ],
  outputViews: [
    {
      id: "v1",
      type: "default",
      blocks: [
        { ...greeting, id: "thanks" },
        { id: "b1", fieldId: "name" },
      ],
    },
  ],
};

const userContent = (schema: FormSchema) => [
  schema.pages[0].fields.map((item) =>
    "manualUserContent" in item ? item.manualUserContent : "field",
  ),
  schema.outputViews[0].blocks.map((block) =>
    "manualUserContent" in block ? block.manualUserContent : "field",
  ),
];

describe("schemaWithMemberContent", () => {
  it("keeps only the member's own entry", () => {
    expect(userContent(schemaWithMemberContent(form, 7))).toEqual([
      [{ "7": { text: "Dear Ana" } }, "field"],
      [{ "7": { text: "Dear Ana" } }, "field"],
    ]);
  });

  it("keeps no entry for a member without one", () => {
    expect(userContent(schemaWithMemberContent(form, 3))).toEqual([
      [undefined, "field"],
      [undefined, "field"],
    ]);
  });

  it("keeps no entry without a member", () => {
    const served = schemaWithMemberContent(form, null);
    expect(JSON.stringify(served)).not.toContain("Dear");
    expect(served.pages[0].fields[0]).toMatchObject({
      text: "Hello",
      manualPerUser: true,
    });
  });
});
