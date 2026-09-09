import type { FormSchema } from "@alliance/common/forms/form-schema";
import {
  __resetAnalyticsForTests,
  registerAnalytics,
  type AnalyticsBackend,
} from "@alliance/shared/lib/analytics";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const storedKey = "1770255651460.webp";
const storedDataUri = "data:image/png;base64,iVBORw0KGgo=";
let storedPhoto = storedKey;

jest.mock("@alliance/shared/client", () => ({
  tasksGetForm: () =>
    Promise.resolve({
      data: {
        schema: {
          pages: [
            {
              id: "source-page",
              fields: [
                {
                  id: "pets",
                  type: "input",
                  kind: "list",
                  label: "Pets",
                  fields: [
                    {
                      id: "photo",
                      type: "input",
                      kind: "file",
                      label: "Photo",
                    },
                  ],
                },
              ],
            },
          ],
          outputViews: [],
        },
      },
    }),
  tasksGetMyFormResponse: () =>
    Promise.resolve({ data: { answers: { pets: [{ photo: storedPhoto }] } } }),
}));

import { imageSrcFromKey } from "../lib/imageSrc";
import FormRenderer from "./FormRenderer";

const recordingBackend: AnalyticsBackend = {
  capture: () => {},
  captureException: () => {},
};

beforeEach(() => {
  storedPhoto = storedKey;
  registerAnalytics(recordingBackend);
});
afterEach(() => {
  cleanup();
  __resetAnalyticsForTests();
});

const schema: FormSchema = {
  pages: [
    {
      id: "page-1",
      fields: [
        {
          id: "pets",
          type: "input",
          kind: "list",
          label: "Pets",
          prefillFromPreviousAnswer: {
            sourceFormId: 9,
            sourceFieldId: "pets",
            sourceSubFieldId: "photo",
            targetSubFieldId: "photo",
          },
          fields: [
            { id: "photo", type: "input", kind: "file", label: "Photo" },
          ],
        },
      ],
    },
  ],
  outputViews: [],
};

async function renderForm(previewMode?: boolean) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <FormRenderer
          form={schema}
          id={1}
          formSnapshotId={1}
          actionId={1}
          onSubmit={previewMode ? null : async () => true}
          previewMode={previewMode}
        />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  await act(async () => {});
}

const photo = () => screen.queryByAltText("Uploaded file");

describe("prefilling a list field from a previous answer", () => {
  it("fills the live form, keeping the stored answer under the api", async () => {
    await renderForm();

    expect(photo()?.getAttribute("src")).toBe(imageSrcFromKey(storedKey));
  });

  it("fills a preview too, so it shows what the member will see", async () => {
    await renderForm(true);

    expect(photo()?.getAttribute("src")).toBe(imageSrcFromKey(storedKey));
  });

  it("keeps a stored data uri under the api in the live form", async () => {
    storedPhoto = storedDataUri;
    await renderForm();

    expect(photo()?.getAttribute("src")).toBe(imageSrcFromKey(storedDataUri));
  });

  it("drops one from a preview, where it would pose as a local pick", async () => {
    storedPhoto = storedDataUri;
    await renderForm(true);

    expect(photo()).toBeNull();
  });
});
