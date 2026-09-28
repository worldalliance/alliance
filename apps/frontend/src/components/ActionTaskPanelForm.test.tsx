import { makeUser } from "@alliance/shared/lib/testFixtures";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext, type AuthContextType } from "../lib/AuthContext";
import { authValue } from "../testing/authValue";
import ActionTaskPanelForm from "./ActionTaskPanelForm";

afterEach(cleanup);

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
