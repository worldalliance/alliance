import type { FormSchema } from "@alliance/common/forms/form-schema";
import { makeFormResponse, makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteOriginLinkProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import FormResponses from "./FormResponses";

afterEach(cleanup);

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
    "GET /tasks/slug/:id": () =>
      Response.json({ id: 4, title: "Survey", formSnapshotId: 7, schema }),
    "GET /tasks/responses/:id": () =>
      Response.json([
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

it("marks a response from a member who withdrew", async () => {
  render(
    <SiteOriginLinkProvider origin="https://worldalliance.org">
      <MemoryRouter initialEntries={["/forms/4/responses"]}>
        <Routes>
          <Route path="/forms/:formId/responses" element={<FormResponses />} />
        </Routes>
      </MemoryRouter>
    </SiteOriginLinkProvider>,
    queryWrapper(),
  );

  expect(await screen.findByText("Withdrew")).toBeTruthy();
});
