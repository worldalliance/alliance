import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { formOf } from "../lib/actionUpdateDetails";
import { actionUpdateAdmin } from "../lib/testing/actionUpdateAdmin";
import { AudienceUpdatePreview } from "./AudienceUpdatePreview";

afterEach(cleanup);

serveApi(
  routes({
    "POST /actions/updates/:id/recognition-preview-counts": () =>
      new Response(null, { status: 500 }),
  }),
);

const renderPreview = (update = actionUpdateAdmin()) =>
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <AudienceUpdatePreview updateId={update.id} form={formOf(update)} />
    </QueryClientProvider>,
  );

describe("AudienceUpdatePreview", () => {
  it("counts no one when nobody is notified", () => {
    renderPreview(actionUpdateAdmin({ notifyType: "none" }));
    expect(screen.getByText("0 members")).toBeTruthy();
  });

  it("says when the recipients couldn't be counted", async () => {
    renderPreview();
    expect(
      await screen.findByText("Couldn't count the recipients."),
    ).toBeTruthy();
  });
});
