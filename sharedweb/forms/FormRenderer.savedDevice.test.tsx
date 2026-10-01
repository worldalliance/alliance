import type { FormSchema } from "@alliance/common/forms/form-schema";
import { makeFormResponse } from "@alliance/shared/lib/testFixtures";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { SiteAppProvider } from "../ui/SiteAppProvider";
import FormRenderer from "./FormRenderer";

afterEach(cleanup);

serveApi(routes({}));

const schema: FormSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "phoneOnly",
          type: "display",
          kind: "text",
          text: "Tap your photo",
          visibleIfFormula: {
            conditions: {
              condition1: { kind: "deviceType", deviceType: ["mobile"] },
            },
            formula: "condition1",
          },
        },
      ],
    },
  ],
  outputViews: [],
};

const renderCompleted = (deviceType: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SiteAppProvider>
          <FormRenderer
            form={schema}
            id={1}
            formSnapshotId={1}
            actionId={1}
            onSubmit={null}
            renderFormAsCompleted
            completedFormResponse={makeFormResponse({ deviceType })}
          />
        </SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

it("shows a completed response as the device it was submitted from", () => {
  renderCompleted("mobile");

  expect(screen.getByText("Tap your photo")).toBeTruthy();
});

it("shows a completed response with no recognized device as the viewer's device", () => {
  const width = window.innerWidth;
  window.innerWidth = 400;
  try {
    renderCompleted("watch");

    expect(screen.getByText("Tap your photo")).toBeTruthy();
  } finally {
    window.innerWidth = width;
  }
});
