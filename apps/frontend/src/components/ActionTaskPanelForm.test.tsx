import { FORMULA_SOURCES_CHANGED } from "@alliance/common/forms/formula-options";
import { makeUser } from "@alliance/shared/lib/testFixtures";
import { recordExceptions } from "@alliance/shared/lib/testing/recordExceptions";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext, type AuthContextType } from "../lib/AuthContext";
import { testAuthUser } from "../stories/testData";
import { authValue } from "../testing/authValue";
import ActionTaskPanelForm from "./ActionTaskPanelForm";

afterEach(cleanup);

const reported = recordExceptions();

const api = serveApi(
  routes({
    "GET /tasks/slug/:id": () =>
      Response.json({
        id: 7,
        title: "task",
        formSnapshotId: 1,
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
      }),
  }),
);

it("seeds a timezone field from a member whose session loads after the form", async () => {
  const queryClient = new QueryClient();
  const panel = (auth: AuthContextType) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SiteAppProvider>
          <AuthContext.Provider value={auth}>
            <ActionTaskPanelForm
              taskFormId={7}
              actionId={1}
              onCompleteAction={null}
              onFormStarted={() => {}}
              publicAction
            />
          </AuthContext.Provider>
        </SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
  const { rerender } = render(panel(authValue({ loading: true })));
  await waitFor(() =>
    expect(queryClient.getQueryData(["form", 7])).toBeDefined(),
  );
  rerender(
    panel(authValue({ user: makeUser({ timeZone: "Pacific/Chatham" }) })),
  );

  expect(await screen.findByRole("combobox", { name: /Chatham/ })).toBeTruthy();
});

it("shows a form with no timezone field before the session loads", async () => {
  api.alsoServing({
    "GET /tasks/slug/:id": () =>
      Response.json({
        id: 8,
        title: "task",
        formSnapshotId: 1,
        schema: {
          pages: [
            {
              id: "p1",
              fields: [
                { id: "name", type: "input", kind: "text", label: "Name" },
              ],
            },
          ],
          outputViews: [],
        },
      }),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SiteAppProvider>
          <AuthContext.Provider value={authValue({ loading: true })}>
            <ActionTaskPanelForm
              taskFormId={8}
              actionId={1}
              onCompleteAction={null}
              onFormStarted={() => {}}
              publicAction
            />
          </AuthContext.Provider>
        </SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  expect(await screen.findByRole("textbox")).toBeTruthy();
});

it("shows the reload instruction, unreported, when the histories its options read changed", async () => {
  api.alsoServing({
    "GET /tasks/slug/:id": () =>
      Response.json({
        id: 5,
        title: "Task",
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
    "GET /tasks/draft/:id": () => Response.json({}),
    "GET /tasks/formDraft/:id": () => Response.json({}),
    "POST /tasks/submitForm/:id": () =>
      Response.json(
        { statusCode: 409, message: FORMULA_SOURCES_CHANGED },
        { status: 409 },
      ),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <SiteAppProvider>
          <AuthContext.Provider value={authValue({ user: testAuthUser })}>
            <ToastProvider>
              <ActionTaskPanelForm
                taskFormId={5}
                actionId={1}
                onCompleteAction={() => {}}
                onFormStarted={() => {}}
              />
            </ToastProvider>
          </AuthContext.Provider>
        </SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "Complete" }));

  expect(await screen.findByText(FORMULA_SOURCES_CHANGED)).toBeTruthy();
  expect(reported).toEqual([]);
});
