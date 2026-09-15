import type { FormSchema } from "@alliance/common/forms/form-schema";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import * as uploadModule from "@alliance/shared/lib/uploadImageDataUri";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SiteAppProvider } from "../ui/SiteAppProvider";
import FormRenderer from "./FormRenderer";

afterEach(cleanup);

serveApi(routes({}));

const form: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "details",
          type: "input",
          kind: "text",
          label: "Details",
          required: true,
          visibleIfFormula: {
            conditions: {
              condition1: { kind: "equals", when: "joined", equals: "yes" },
            },
            formula: "condition1",
          },
        },
      ],
    },
    {
      id: "p2",
      fields: [
        {
          id: "joined",
          type: "input",
          kind: "radio",
          label: "Joined before?",
          options: [
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ],
        },
      ],
    },
  ],
  outputViews: [],
};

const renderPreview = (schema: FormSchema) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SiteAppProvider>
          <FormRenderer
            form={schema}
            id={1}
            formSnapshotId={null}
            actionId={1}
            onSubmit={null}
          />
        </SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("FormRenderer preview", () => {
  it("validates every page, going back to the first invalid one", async () => {
    renderPreview(form);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    });
    fireEvent.click(await screen.findByLabelText("Yes"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Preview Mode/ }));
    });

    expect(await screen.findByText(/Details/)).toBeTruthy();
    expect(screen.getByText(/This field is required/)).toBeTruthy();
  });

  it("does not validate while a file is uploading", async () => {
    jest
      .spyOn(uploadModule, "uploadImageDataUri")
      .mockImplementation(() => new Promise(() => {}));
    const { container } = renderPreview({
      pages: [
        {
          id: "p1",
          fields: [
            {
              id: "photo",
              type: "input",
              kind: "file",
              label: "Photo",
              required: true,
            },
          ],
        },
      ],
      outputViews: [],
    });

    const input = container.querySelector('input[type="file"]');
    if (!input) throw new Error("file input not rendered");
    fireEvent.change(input, {
      target: { files: [new File(["x"], "photo.png", { type: "image/png" })] },
    });
    await screen.findByText("Uploading...");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Preview Mode/ }));
    });

    expect(screen.queryByText("Please upload a file.")).toBeNull();
  });
});
