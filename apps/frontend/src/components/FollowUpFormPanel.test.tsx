import { FORMULA_SOURCES_CHANGED } from "@alliance/common/forms/formula-options";
import { recordExceptions } from "@alliance/shared/lib/testing/recordExceptions";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext } from "../lib/AuthContext";
import { testAuthUser } from "../stories/testData";
import { authValue } from "../testing/authValue";
import FollowUpFormPanel from "./FollowUpFormPanel";

afterEach(cleanup);

const reported = recordExceptions();

serveApi(
  routes({
    "GET /tasks/slug/:id": () =>
      Response.json({
        id: 5,
        title: "Follow-up",
        formSnapshotId: 6,
        schema: {
          pages: [
            {
              id: "p1",
              fields: [
                { id: "note", type: "input", kind: "text", label: "Note" },
              ],
            },
          ],
          outputViews: [],
        },
      }),
    "POST /tasks/submitFollowUpForm/:followUpFormId": () =>
      Response.json(
        { statusCode: 409, message: FORMULA_SOURCES_CHANGED },
        { status: 409 },
      ),
  }),
);

it("shows the reload instruction, unreported, when the histories its options read changed", async () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SiteAppProvider>
          <AuthContext.Provider value={authValue({ user: testAuthUser })}>
            <ToastProvider>
              <FollowUpFormPanel
                followUpForm={{
                  id: 3,
                  name: null,
                  startDate: null,
                  endDate: null,
                  instructions: null,
                  actionId: 1,
                  formId: 5,
                }}
                actionId={1}
              />
            </ToastProvider>
          </AuthContext.Provider>
        </SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "Submit" }));

  expect(await screen.findByText(FORMULA_SOURCES_CHANGED)).toBeTruthy();
  expect(reported).toEqual([]);
});
