import { formSchema } from "@alliance/common/forms/form-schema";
import { describe, expect, it } from "bun:test";
import { formTexts } from "./actionReadiness";

describe("formTexts", () => {
  it("collects the form, page, field, option, and display text in order", () => {
    const schema = formSchema.parse({
      description: "Form intro",
      outputViews: [],
      pages: [
        {
          id: "p1",
          title: "Page title",
          description: "Page intro",
          fields: [
            {
              id: "town",
              type: "input",
              kind: "radio",
              label: "Your town",
              description: "Pick one",
              options: [
                { value: "a", label: "Ames" },
                { value: "b", label: "Boone" },
              ],
            },
            { id: "intro", type: "display", kind: "text", text: "Welcome" },
          ],
        },
      ],
    });

    expect(formTexts(schema)).toEqual([
      "Form intro",
      "Page title",
      "Page intro",
      "Your town",
      "Pick one",
      "Ames",
      "Boone",
      "Welcome",
    ]);
  });
});
