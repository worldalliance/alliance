import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, screen } from "@testing-library/react";
import { renderFormBuilder } from "../lib/testing/renderFormBuilder";

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [{ id: "town", type: "input", kind: "text", label: "Town" }],
    },
  ],
  outputViews: [],
  aggregateViews: [],
};

describe("FormBuilder creating a form", () => {
  serveApi(
    routes(
      {
        "POST /tasks/createForm": () =>
          Response.json({ message: "Nope" }, { status: 500 }),
      },
      () => Response.json([]),
    ),
  );

  it("reports a refused create as an update's refusal reads", async () => {
    renderFormBuilder(schema);
    fireEvent.change(screen.getByPlaceholderText("Page title"), {
      target: { value: "Where" },
    });
    fireEvent.click(screen.getByText("Save Form"));
    expect(
      (await screen.findAllByText("Could not save form")).length,
    ).toBeGreaterThan(0);
  });
});
