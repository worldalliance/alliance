import {
  FORM_ALREADY_SUBMITTED,
  MEMBER_ACTION_DEADLINE_PASSED,
} from "@alliance/common/actionActivity";
import { FORMULA_SOURCES_CHANGED } from "@alliance/common/forms/formula-options";
import type { ActionDto, FormResponseDto } from "@alliance/shared/client";
import { computeFormStorageKey } from "@alliance/shared/forms/formDrafts";
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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext, type AuthContextType } from "../lib/AuthContext";
import { testAuthUser } from "../stories/testData";
import { authValue } from "../testing/authValue";
import ActionTaskPanelForm from "./ActionTaskPanelForm";

declare const happyDOM: { setURL: (url: string) => void };

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
  onCompleteAction = () => {},
  onSubmitted,
  queryClient = new QueryClient(),
  auth = authValue({ user: testAuthUser }),
  publicAction,
}: {
  serving: RouteTable;
  onDeadlinePassed?: () => void;
  onCompleteAction?: () => void;
  onSubmitted?: (response: FormResponseDto) => void;
  queryClient?: QueryClient;
  auth?: AuthContextType;
  publicAction?: boolean;
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
          <AuthContext.Provider value={auth}>
            <ToastProvider>
              <ActionTaskPanelForm
                taskFormId={5}
                actionId={1}
                onCompleteAction={onCompleteAction}
                onSubmitted={onSubmitted}
                onFormStarted={() => {}}
                onDeadlinePassed={onDeadlinePassed}
                publicAction={publicAction}
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

it("reloads the page, unreported, when the form was already submitted", async () => {
  const reload = jest
    .spyOn(window.location, "reload")
    .mockImplementation(() => {});

  try {
    await submitRefusedWith({
      statusCode: 400,
      message: FORM_ALREADY_SUBMITTED,
    });

    await waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(reported).toEqual([]);
  } finally {
    reload.mockRestore();
  }
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

it("completes with the served response and drops the local draft once the server accepts the submission", async () => {
  const served = makeFormResponse({ answers: { note: "done" } });
  const draftKey = computeFormStorageKey({ formId: 5, instanceId: 5 });
  window.localStorage.setItem(draftKey, "{}");
  const onSubmitted = jest.fn();
  const onCompleteAction = jest.fn();
  renderMemberNoteForm({
    serving: {
      "POST /tasks/submitForm/:id": () =>
        Response.json(served, { status: 201 }),
    },
    onSubmitted,
    onCompleteAction,
  });

  fireEvent.click(await screen.findByRole("button", { name: "Complete" }));

  await waitFor(() => expect(onCompleteAction).toHaveBeenCalledTimes(1));
  expect(onSubmitted).toHaveBeenCalledWith(served);
  expect(window.localStorage.getItem(draftKey)).toBeNull();
});

it("sends a guest to the completed page after their public task completes", async () => {
  const startHref = window.location.href;
  happyDOM.setURL("http://localhost/actions/1");
  let pathOnComplete: string | null = null;
  try {
    renderMemberNoteForm({
      serving: {
        "POST /tasks/submitPublicForm/:id": () =>
          Response.json(makeFormResponse(), { status: 201 }),
      },
      auth: authValue(),
      publicAction: true,
      onCompleteAction: () => {
        pathOnComplete = window.location.pathname;
      },
    });

    fireEvent.click(await screen.findByRole("button", { name: "Complete" }));

    await waitFor(() =>
      expect(window.location.pathname).toBe("/actions/completed"),
    );
    expect(pathOnComplete).toBe("/actions/1");
  } finally {
    happyDOM.setURL(startHref);
  }
});

it("refreshes a member without a contract once their task completes", async () => {
  const refreshUser = jest.fn(() => Promise.resolve());
  renderMemberNoteForm({
    serving: {
      "POST /tasks/submitForm/:id": () =>
        Response.json(makeFormResponse(), { status: 201 }),
    },
    auth: authValue({
      user: makeUser({ hasActiveContract: false }),
      refreshUser,
    }),
  });

  fireEvent.click(await screen.findByRole("button", { name: "Complete" }));

  await waitFor(() => expect(refreshUser).toHaveBeenCalledTimes(1));
});

it("invalidates the form's aggregate views once the server accepts the submission", async () => {
  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKeys.taskFormAggregateViews(5), []);
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
      queryClient.getQueryState(queryKeys.taskFormAggregateViews(5))
        ?.isInvalidated,
    ).toBe(true),
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
