import type { FormSchema } from "@alliance/common/forms/form-schema";
import { client } from "@alliance/shared/client/client.gen";
import { AuthoredLinkProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { FormBuilder } from "./FormBuilder";

afterEach(cleanup);

const readsTown = {
  inputs: { input1: { kind: "field", fieldId: "town" } },
  formula: "input1",
} as const;

const mine: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [{ id: "town", type: "input", kind: "text", label: "Town" }],
    },
  ],
  outputViews: [],
  aggregateViews: [],
  variables: [
    { name: "a", ...readsTown },
    { name: "b", ...readsTown },
  ],
};

function renderBuilder() {
  const router = createMemoryRouter([
    {
      path: "/",
      element: (
        <FormBuilder formId={1} initialSchema={mine} setFormId={() => {}} />
      ),
    },
  ]);
  render(
    <AuthoredLinkProvider>
      <QueryClientProvider client={new QueryClient()}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </QueryClientProvider>
    </AuthoredLinkProvider>,
  );
}

describe("FormBuilder save conflict", () => {
  const { baseUrl, fetch } = client.getConfig();
  afterEach(() => client.setConfig({ baseUrl, fetch }));

  beforeEach(() => {
    const theirs = { ...mine, variables: [{ name: "b", ...readsTown }] };
    client.setConfig({
      baseUrl: "http://localhost",
      fetch: async (request: Request) =>
        request.method === "GET"
          ? Response.json({ id: 1, schema: theirs, formSnapshotId: 2 })
          : new Response(null, { status: 409 }),
    });
    jest.spyOn(window, "confirm").mockReturnValue(true);
  });

  it.each(["Take theirs", "Merge changes"])(
    "%s clears every variable's sample answers",
    async (resolve) => {
      renderBuilder();
      fireEvent.change(screen.getByPlaceholderText("Page title"), {
        target: { value: "Where" },
      });
      fireEvent.click(screen.getByText("Variables"));
      const [first, second] = screen.getAllByLabelText<HTMLInputElement>(
        "Sample answer for input1",
      );
      fireEvent.change(first!, { target: { value: "Oslo" } });
      fireEvent.change(second!, { target: { value: "Lima" } });
      fireEvent.click(screen.getByText("Save Form"));
      fireEvent.click(await screen.findByText(resolve));

      await waitFor(() =>
        expect(
          screen.getAllByLabelText<HTMLInputElement>(
            "Sample answer for input1",
          ),
        ).toHaveLength(1),
      );
      expect(
        screen.getByLabelText<HTMLInputElement>("Sample answer for input1")
          .value,
      ).toBe("");
    },
  );
});
