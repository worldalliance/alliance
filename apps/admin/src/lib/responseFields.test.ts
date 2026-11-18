import type { FormSchema } from "@alliance/common/forms/form-schema";
import { answerFieldLabels } from "./responseFields";

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        { id: "name", type: "input", kind: "text", label: "Name" },
        { id: "note", type: "display", kind: "label", text: "" },
        {
          id: "sig",
          type: "input",
          kind: "custom",
          label: "Signature",
          componentId: "sig",
        },
      ],
    },
    {
      id: "p2",
      fields: [
        { id: "age", type: "input", kind: "number", label: "Age" },
        { id: "name", type: "input", kind: "text", label: "Name again" },
      ],
    },
  ],
  outputViews: [],
};

it("labels answer fields in page order, first occurrence winning", () => {
  const labels = answerFieldLabels(schema);

  expect([...labels.keys()]).toEqual(["name", "age"]);
  expect(labels.get("name")).toBe("Name");
});

it("lists the image upload, toggle and time picker answers", () => {
  expect([
    ...answerFieldLabels({
      pages: [
        {
          id: "p1",
          fields: [
            { id: "photo", type: "input", kind: "image", label: "Photo" },
            { id: "email", type: "input", kind: "toggle", label: "Email" },
            { id: "time", type: "input", kind: "timePicker", label: "Time" },
          ],
        },
      ],
      outputViews: [],
    }).keys(),
  ]).toEqual(["photo", "email", "time"]);
});
