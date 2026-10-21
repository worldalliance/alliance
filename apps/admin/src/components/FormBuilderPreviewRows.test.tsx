import type { FormSchema } from "@alliance/common/forms/form-schema";
import { RowConditionKind } from "@alliance/common/forms/row-list-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, screen } from "@testing-library/react";
import { renderFormBuilder } from "../lib/testing/renderFormBuilder";

serveApi(routes({}, () => Response.json([])));

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "intro",
          type: "display",
          kind: "text",
          text: "File with #{row.jurisdiction} #{row.type}",
        },
        {
          id: "emailOnly",
          type: "display",
          kind: "text",
          text: "Email #{row.email}",
          rowCondition: { kind: RowConditionKind.HasValue, field: "email" },
        },
      ],
    },
  ],
  outputViews: [],
  rowList: {
    rows: [
      { jurisdiction: "Springfield", type: "City", email: null },
      {
        jurisdiction: "Springfield",
        type: "County",
        email: "records@example.gov",
      },
    ],
    keyFields: ["jurisdiction", "type"],
  },
};

it("previews the form as the picked row would see it", async () => {
  renderFormBuilder(schema);
  fireEvent.click(screen.getByRole("button", { name: "Preview" }));

  expect(await screen.findByText("File with Springfield City")).toBeTruthy();
  expect(screen.queryByText(/^Email/)).toBeNull();

  fireEvent.change(screen.getByLabelText("Preview as row"), {
    target: { value: "1" },
  });
  expect(await screen.findByText("File with Springfield County")).toBeTruthy();
  expect(screen.getByText("Email records@example.gov")).toBeTruthy();
});
