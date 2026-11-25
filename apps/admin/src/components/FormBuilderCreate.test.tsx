import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { renderFormBuilder } from "../lib/testing/renderFormBuilder";
import FormBuilderPage from "../pages/FormBuilder";
import { SiteOriginLinkProvider } from "../ui/SiteAppProvider";
import { ToastProvider } from "../ui/ToastProvider";
import LeaveGuard from "./LeaveGuard";

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

describe("FormBuilder saving a new form", () => {
  serveApi(
    routes(
      {
        "POST /tasks/createForm": () =>
          Response.json({ id: 5, schema, formSnapshotId: 1 }),
      },
      () => Response.json([]),
    ),
  );

  it("opens it once saved, without asking about the changes just saved", async () => {
    const leaveAsked = jest.spyOn(window, "confirm").mockReturnValue(false);
    const router = createMemoryRouter(
      [
        {
          path: "/tasks/forms/:formId",
          element: (
            <LeaveGuard>
              <FormBuilderPage />
            </LeaveGuard>
          ),
        },
      ],
      { initialEntries: ["/tasks/forms/new"] },
    );
    render(
      <SiteOriginLinkProvider origin="https://worldalliance.org">
        <QueryClientProvider client={new QueryClient()}>
          <ToastProvider>
            <RouterProvider router={router} />
          </ToastProvider>
        </QueryClientProvider>
      </SiteOriginLinkProvider>,
    );
    fireEvent.change(screen.getByPlaceholderText("Page title"), {
      target: { value: "Where" },
    });
    fireEvent.click(screen.getByText("Save Form"));

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/tasks/forms/5"),
    );
    expect(leaveAsked).not.toHaveBeenCalled();
  });
});
