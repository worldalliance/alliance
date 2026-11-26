import type { FormSchema } from "@alliance/common/forms/form-schema";
import { client } from "@alliance/shared/client/client.gen";
import { fireEvent, screen, within } from "@testing-library/react";
import { answerLeaveGuard } from "../lib/testing/leaveGuard";
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
  variables: [],
};

describe("FormBuilder save conflict errors", () => {
  const { baseUrl, fetch } = client.getConfig();
  afterEach(() => client.setConfig({ baseUrl, fetch }));

  beforeEach(() => {
    client.setConfig({
      baseUrl: "http://localhost",
      fetch: async (request: Request) => {
        if (request.method !== "GET")
          return new Response(null, { status: 409 });
        return new URL(request.url).pathname === "/tasks/listForms"
          ? Response.json([])
          : Response.json({ id: 1, schema, formSnapshotId: 2 });
      },
    });
    answerLeaveGuard(true);
  });

  it("says a repeat conflict on Keep mine inside the dialog, and forgets it on Cancel", async () => {
    renderFormBuilder(schema, 1);
    fireEvent.change(screen.getByPlaceholderText("Page title"), {
      target: { value: "Where" },
    });
    fireEvent.click(screen.getByText("Save Form"));
    const dialog = await screen.findByRole("dialog", {
      name: "This form was changed by someone else",
    });
    fireEvent.click(within(dialog).getByText("Keep mine (overwrite theirs)"));
    expect((await within(dialog).findByRole("alert")).textContent).toContain(
      "Someone saved again",
    );

    fireEvent.click(within(dialog).getByText("Cancel"));
    expect(screen.queryByText(/Someone saved again/)).toBeNull();
  });
});
