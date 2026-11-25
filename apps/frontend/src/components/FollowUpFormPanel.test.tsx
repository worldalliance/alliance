import { FORMULA_SOURCES_CHANGED } from "@alliance/common/forms/formula-options";
import { makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { recordExceptions } from "@alliance/shared/lib/testing/recordExceptions";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext, type AuthContextType } from "../lib/AuthContext";
import { testAuthUser } from "../stories/testData";
import { authValue } from "../testing/authValue";
import FollowUpFormPanel from "./FollowUpFormPanel";

const reported = recordExceptions();

const api = serveApi(
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

const panel = (auth: AuthContextType) => (
  <MemoryRouter>
    <SiteAppProvider>
      <AuthContext.Provider value={auth}>
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
);

const renderPanel = (auth = authValue({ user: testAuthUser })) =>
  render(panel(auth), { wrapper: queryWrapper().wrapper });

it("shows the reload instruction, unreported, when the histories its options read changed", async () => {
  renderPanel();

  fireEvent.click(await screen.findByRole("button", { name: "Submit" }));

  expect(await screen.findByText(FORMULA_SOURCES_CHANGED)).toBeTruthy();
  expect(reported).toEqual([]);
});

it("shows the server's message when the form fails to load", async () => {
  api.alsoServing({
    "GET /tasks/slug/:id": () =>
      Response.json({ message: "Form not found" }, { status: 404 }),
  });

  renderPanel();

  expect(await screen.findByText("Form not found")).toBeTruthy();
});

it("seeds a timezone field from a member whose session loads after the form", async () => {
  let formLoaded = false;
  api.alsoServing({
    "GET /tasks/slug/:id": () => {
      formLoaded = true;
      return Response.json({
        id: 5,
        title: "Follow-up",
        formSnapshotId: 6,
        schema: {
          pages: [
            {
              id: "p1",
              fields: [
                { id: "tz", type: "input", kind: "timezone", label: "Zone" },
              ],
            },
          ],
          outputViews: [],
        },
      });
    },
  });

  const { rerender } = renderPanel(authValue({ loading: true }));
  await waitFor(() => expect(formLoaded).toBe(true));
  rerender(
    panel(authValue({ user: makeUser({ timeZone: "Pacific/Chatham" }) })),
  );

  expect(await screen.findByRole("combobox", { name: /Chatham/ })).toBeTruthy();
});
