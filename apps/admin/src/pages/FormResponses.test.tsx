import type { FormSchema } from "@alliance/common/forms/form-schema";
import { makeFormResponse, makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteOriginLinkProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import FormResponses from "./FormResponses";

let responsesStatus = 200;
beforeEach(() => {
  responsesStatus = 200;
});

const schema: FormSchema = {
  pages: [
    {
      id: "page-1",
      fields: [{ id: "home", type: "input", kind: "text", label: "Home" }],
    },
  ],
  outputViews: [],
};

serveApi(
  routes({
    "GET /tasks/adminForm/:id": () =>
      Response.json({ id: 4, title: "Survey", formSnapshotId: 7, schema }),
    "GET /tasks/responses/:id": () =>
      responsesStatus !== 200
        ? Response.json({}, { status: responsesStatus })
        : Response.json([
            makeFormResponse({
              formId: 4,
              formSnapshotId: 7,
              schemaSnapshot: schema,
              answers: { home: "Paris" },
              user: makeUser({ id: 3, name: "Withdrawn Member" }),
            }),
          ]),
    "GET /actions/shareLinksForForm/:formId": () => Response.json([]),
    "GET /actions/withdrawals/byForm/:formId": () =>
      Response.json([
        { userId: 3, declineReason: null, isMoral: false, outOfTime: false },
      ]),
  }),
);

const renderPage = (path = "/forms/4/responses") =>
  render(
    <SiteOriginLinkProvider origin="https://worldalliance.org">
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path="/forms/:formId/responses"
              element={<FormResponses />}
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </SiteOriginLinkProvider>,
    queryWrapper(),
  );

it("marks a response from a member who withdrew", async () => {
  renderPage();
  expect(await screen.findByText("Withdrew")).toBeTruthy();
});

it("says the form id is invalid instead of loading forever", async () => {
  renderPage("/forms/abc/responses");
  expect(await screen.findByText("Invalid form id.")).toBeTruthy();
});

it("says so when the responses fail to load", async () => {
  responsesStatus = 500;
  renderPage();
  expect(await screen.findByText("Failed to load form responses")).toBeTruthy();
});

it("toasts a failed refresh and keeps the responses up", async () => {
  renderPage();
  expect(await screen.findByText("Withdrew")).toBeTruthy();

  responsesStatus = 500;
  fireEvent.click(screen.getByText("Refresh"));

  expect(
    await screen.findByText("Failed to refresh form responses"),
  ).toBeTruthy();
  expect(await screen.findByText("Withdrew")).toBeTruthy();
});
