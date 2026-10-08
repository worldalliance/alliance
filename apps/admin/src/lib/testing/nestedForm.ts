import type { FormSchema } from "@alliance/common/forms/form-schema";
import { canvasOrder } from "./formCanvas";

/** A list and an accordion, for tests of what they hold. */
export const nestedSchema: FormSchema = {
  pages: [
    {
      id: "p1",
      title: "One",
      fields: [
        {
          id: "kids",
          type: "input",
          kind: "list",
          label: "Kids",
          fields: [
            { id: "name", type: "input", kind: "text", label: "Name" },
            { id: "age", type: "input", kind: "number", label: "Age" },
          ],
        },
        {
          id: "faq",
          type: "display",
          kind: "accordion",
          sections: [
            {
              id: "s1",
              title: "Shipping",
              blocks: [
                { id: "t1", type: "display", kind: "text", text: "Ships fast" },
              ],
            },
            { id: "s2", title: "Returns", blocks: [] },
          ],
        },
      ],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

export const subFieldOrder = () => canvasOrder(/^Select (Text|Number) Field/);
