import { MEMBER_ACTION_DEADLINE_PASSED } from "@alliance/common/actionActivity";
import { FORMULA_SOURCES_CHANGED } from "@alliance/common/forms/formula-options";
import type { ActionDto } from "@alliance/shared/client";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  makeAction,
  makeFormResponse,
  makeUser,
} from "@alliance/shared/lib/testFixtures";
import { recordExceptions } from "@alliance/shared/lib/testing/recordExceptions";
import {
  routes,
  serveApi,
  type RouteTable,
} from "@alliance/shared/lib/testing/serveApi";
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
              onDeadlinePassed={() => {}}
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
    expect(queryClient.getQueryData(queryKeys.taskForm(7))).toBeDefined(),
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
              onDeadlinePassed={() => {}}
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

const renderMemberNoteForm = ({
  serving,
  onDeadlinePassed = () => {},
  queryClient = new QueryClient(),
}: {
  serving: RouteTable;
  onDeadlinePassed?: () => void;
  queryClient?: QueryClient;
}) => {
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
    ...serving,
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <SiteAppProvider>
          <AuthContext.Provider value={authValue({ user: testAuthUser })}>
            <ToastProvider>
              <ActionTaskPanelForm
                taskFormId={5}
                actionId={1}
                onCompleteAction={() => {}}
                onFormStarted={() => {}}
                onDeadlinePassed={onDeadlinePassed}
              />
            </ToastProvider>
          </AuthContext.Provider>
        </SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const submitRefusedWith = async (
  refusal: { statusCode: number; message: string },
  onDeadlinePassed: () => void = () => {},
) => {
  renderMemberNoteForm({
    serving: {
      "POST /tasks/submitForm/:id": () =>
        Response.json(refusal, { status: refusal.statusCode }),
    },
    onDeadlinePassed,
  });

  fireEvent.click(await screen.findByRole("button", { name: "Complete" }));
};

it("shows the reload instruction, unreported, when the histories its options read changed", async () => {
  await submitRefusedWith({
    statusCode: 409,
    message: FORMULA_SOURCES_CHANGED,
  });

  expect(await screen.findByText(FORMULA_SOURCES_CHANGED)).toBeTruthy();
  expect(reported).toEqual([]);
});

it("refetches the action, unreported, when the deadline passed before the submit", async () => {
  const onDeadlinePassed = jest.fn();

  await submitRefusedWith(
    { statusCode: 403, message: MEMBER_ACTION_DEADLINE_PASSED },
    onDeadlinePassed,
  );

  expect(await screen.findByText(MEMBER_ACTION_DEADLINE_PASSED)).toBeTruthy();
  expect(onDeadlinePassed).toHaveBeenCalledTimes(1);
  expect(reported).toEqual([]);
});

it("marks the cached action completed once the server accepts the submission", async () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKeys.actions(), [makeAction({ id: 1 })]);
  renderMemberNoteForm({
    serving: {
      "POST /tasks/submitForm/:id": () =>
        Response.json(makeFormResponse(), { status: 201 }),
    },
    queryClient,
  });

  fireEvent.click(await screen.findByRole("button", { name: "Complete" }));

  await waitFor(() =>
    expect(
      queryClient.getQueryData<ActionDto[]>(queryKeys.actions())?.[0]?.viewer
        ?.relation,
    ).toBe("completed"),
  );
});

it("prefills a member's form with the draft they left as a guest", async () => {
  renderMemberNoteForm({
    serving: {
      "GET /tasks/draft/:id": () =>
        Response.json({
          draft: makeFormResponse({ answers: { note: "from my guest visit" } }),
        }),
    },
  });

  expect(await screen.findByDisplayValue("from my guest visit")).toBeTruthy();
});
