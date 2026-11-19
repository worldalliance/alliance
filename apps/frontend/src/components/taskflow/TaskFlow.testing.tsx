import type { ActionDto } from "@alliance/shared/client";
import { taskFlow, taskFlowFallbackTitle } from "@alliance/shared/lib/copy";
import { TaskFlowCompletionProvider } from "@alliance/shared/lib/TaskFlowCompletionContext";
import { TaskFlowReturnProvider } from "@alliance/shared/lib/TaskFlowReturnContext";
import {
  makeAction,
  makeFormResponse,
} from "@alliance/shared/lib/testFixtures";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { SiteAppProvider } from "@alliance/sharedweb/ui/SiteAppProvider";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { useContext, type ReactNode } from "react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
  type NavigateFunction,
} from "react-router";
import { AuthContext, type AuthContextType } from "../../lib/AuthContext";
import {
  ImmersiveTone,
  NavbarOptionsContext,
  NavbarOptionsProvider,
} from "../../lib/NavbarOptionsContext";
import { testAuthUser } from "../../stories/testData";
import { authValue } from "../../testing/authValue";
import ActionTaskPanelForm from "../ActionTaskPanelForm";

const textInput = (id: string, label: string, required = false) => ({
  id,
  type: "input",
  kind: "text",
  label,
  required,
});

export const taskSchema = {
  pages: [
    {
      id: "p1",
      fields: [
        {
          id: "intro",
          type: "display",
          kind: "text",
          text: "Why this project matters",
        },
      ],
    },
    {
      id: "p2",
      fields: [
        {
          id: "h",
          type: "display",
          kind: "header",
          text: "Rate the chatbot",
        },
        textInput("a", "First impression", true),
        textInput("b", "Tone"),
      ],
    },
    {
      id: "p3",
      fields: [
        {
          id: "h2",
          type: "display",
          kind: "header",
          text: "Rate the chatbot",
        },
        textInput("c", "Anything else"),
      ],
    },
  ],
  outputViews: [],
};

export const action: ActionDto = makeAction({
  id: 1,
  name: "Review chatbot transcripts",
  reviewers: [{ name: "Sam Reviewer" }],
});
let serverAction = action;
let servedSchema: unknown = taskSchema;
let submissions = 0;
let submitStatus = 201;
let draftSaveStatus = 200;
let submitHeld = Promise.resolve();
let visibilityContextHeld = Promise.resolve();
let visibilityContextRequested = false;
let visibilityContextStatus = 200;
export enum DraftSource {
  OtherDevice = "another device",
  Guest = "a guest visit",
}
let heldDraft: {
  source: DraftSource;
  answers: Record<string, unknown>;
  status?: number;
  held: Promise<void>;
  requested: boolean;
} | null = null;

const serveHeldDraft = async (
  source: DraftSource,
  draft: (answers: Record<string, unknown>) => unknown,
) => {
  if (heldDraft?.source !== source) return Response.json({});
  heldDraft.requested = true;
  await heldDraft.held;
  if (heldDraft.status !== undefined) {
    return Response.json({ message: "nope" }, { status: heldDraft.status });
  }
  return Response.json({ draft: draft(heldDraft.answers) });
};

/** Serves the flow's task form and action for every test in the calling file,
 * resetting the served schema and action, the submission count and the
 * submit's status before each test. Call at file scope. */
export const serveTaskFlow = () => {
  serveApi(
    routes({
      "GET /tasks/slug/:id": () =>
        Response.json({
          id: 9,
          title: "Review",
          formSnapshotId: 3,
          schema: servedSchema,
        }),
      "GET /tasks/draft/:id": () =>
        serveHeldDraft(DraftSource.Guest, (answers) =>
          makeFormResponse({ answers }),
        ),
      "GET /tasks/formDraft/:id": () =>
        serveHeldDraft(DraftSource.OtherDevice, (answers) => ({
          formId: 9,
          actionId: 1,
          formSnapshotId: 3,
          answers,
          publicAnswers: {},
          currentPageIndex: 0,
          updatedAt: "2026-10-25T00:00:00.000Z",
        })),
      "PUT /tasks/formDraft/:id": () =>
        draftSaveStatus === 200
          ? Response.json({ updatedAt: "2026-10-26T00:00:00.000Z" })
          : Response.json({ message: "nope" }, { status: draftSaveStatus }),
      "POST /tasks/submitForm/:id": async () => {
        submissions += 1;
        await submitHeld;
        return submitStatus === 201
          ? Response.json(makeFormResponse(), { status: 201 })
          : Response.json({ message: "nope" }, { status: submitStatus });
      },
      "POST /tasks/submitPublicForm/:id": () => {
        submissions += 1;
        return Response.json(makeFormResponse(), { status: 201 });
      },
      "GET /user/mylocation": () => Response.json({ city: null }),
      "GET /auth/me": () => Response.json({ user: testAuthUser }),
      "GET /user/myvisibilitycontext": async () => {
        visibilityContextRequested = true;
        await visibilityContextHeld;
        if (visibilityContextStatus !== 200) {
          return Response.json(
            { message: "nope" },
            { status: visibilityContextStatus },
          );
        }
        return Response.json({
          userHasCity: true,
          userPropertyHasValue: {},
          firstContractSignedAt: null,
          completedActionCount: 0,
        });
      },
      "GET /actions/slug/:id": () => Response.json(serverAction),
    }),
  );
  beforeEach(() => {
    serverAction = action;
    servedSchema = taskSchema;
    submissions = 0;
    submitStatus = 201;
    draftSaveStatus = 200;
    submitHeld = Promise.resolve();
    visibilityContextHeld = Promise.resolve();
    visibilityContextRequested = false;
    visibilityContextStatus = 200;
    heldDraft = null;
  });
};

export let navigate: NavigateFunction;
function CaptureNavigate() {
  navigate = useNavigate();
  return null;
}

// react-router keys the initial entry "default" and every navigation afresh,
// so a navigation to the path already shown is visible here.
function CaptureLocation() {
  const { pathname, key } = useLocation();
  return <p>{`at ${pathname} ${key}`}</p>;
}

function NavMode() {
  const options = useContext(NavbarOptionsContext)?.options;
  return (
    <>
      <p>{options?.immersive ? "nav collapsed" : "nav expanded"}</p>
      <p>
        {options?.immersiveTone === ImmersiveTone.Success
          ? "nav green"
          : "nav plain"}
      </p>
    </>
  );
}

export function renderFlow({
  onCompleteAction = () => {},
  queryClient = new QueryClient(),
  page,
  path = "/actions/1",
  auth = authValue({ user: testAuthUser }),
}: {
  onCompleteAction?: () => void;
  queryClient?: QueryClient;
  page?: ReactNode;
  path?: string;
  auth?: AuthContextType;
} = {}) {
  window.localStorage.clear();
  const pageElement = page ?? (
    <ActionTaskPanelForm
      taskFormId={9}
      onCompleteAction={onCompleteAction}
      onFormStarted={() => {}}
      onDeadlinePassed={() => {}}
      action={action}
    />
  );
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <SiteAppProvider>
          <AuthContext.Provider value={auth}>
            <ToastProvider>
              <TaskFlowReturnProvider>
                <TaskFlowCompletionProvider>
                  <NavbarOptionsProvider>
                    <CaptureNavigate />
                    <CaptureLocation />
                    <NavMode />
                    <Routes>
                      <Route path="/actions/1" element={pageElement} />
                      <Route path="/actions/2" element={pageElement} />
                      <Route path="/" element={pageElement} />
                      <Route
                        path="/tasks"
                        element={
                          path === "/tasks" ? pageElement : <p>Tasks home</p>
                        }
                      />
                      <Route path="/forum" element={<p>Forum</p>} />
                      <Route path="/invites" element={<p>Invites</p>} />
                      <Route path="/signup" element={<p>Signup</p>} />
                    </Routes>
                  </NavbarOptionsProvider>
                </TaskFlowCompletionProvider>
              </TaskFlowReturnProvider>
            </ToastProvider>
          </AuthContext.Provider>
        </SiteAppProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export const openFirstQuestionScreen = async () => {
  fireEvent.click(await screen.findByRole("button", { name: taskFlow.begin }));
  await screen.findByRole("heading", { name: taskFlowFallbackTitle.reading });
  fireEvent.click(screen.getByRole("button", { name: taskFlow.next }));
  await screen.findByRole("heading", { name: "Rate the chatbot" });
};

/** Long enough for the completion card's whole closing animation. */
export const CLOSE_TIMEOUT = 3000;

export const submitFlow = async () => {
  await openFirstQuestionScreen();
  fireEvent.change(screen.getByRole("textbox", { name: /First impression/ }), {
    target: { value: "Helpful" },
  });
  fireEvent.click(screen.getByRole("button", { name: taskFlow.next }));
  fireEvent.click(await screen.findByRole("button", { name: taskFlow.submit }));
  await screen.findByRole("heading", { name: taskFlow.complete });
};

/** Sets what the server returns for the action until the next test. */
export const setServerAction = (next: ActionDto) => {
  serverAction = next;
};

/** Sets the status the submit answers with until the next test. */
export const setSubmitStatus = (status: number) => {
  submitStatus = status;
};

/** Sets the status a draft save answers with until the next test. */
export const setDraftSaveStatus = (status: number) => {
  draftSaveStatus = status;
};

/** Holds the submit's response until the returned release is called. */
export const holdSubmit = () => {
  let release = () => {};
  submitHeld = new Promise((resolve) => {
    release = resolve;
  });
  return release;
};

/**
 * Holds the visibility context's response until the returned release is
 * called. It answers that the member has a city.
 */
export const holdVisibilityContext = () => {
  let release = () => {};
  visibilityContextHeld = new Promise((resolve) => {
    release = resolve;
  });
  return release;
};

/** Refuses the visibility context until the next test. */
export const refuseVisibilityContext = () => {
  visibilityContextStatus = 403;
};

export const visibilityContextWasRequested = () => visibilityContextRequested;

/**
 * Serves a draft with these answers from the source's endpoint once the
 * returned release is called, or fails with `status` when one is given.
 */
export const holdDraft = (params: {
  source: DraftSource;
  answers: Record<string, unknown>;
  status?: number;
}) => {
  let release = () => {};
  heldDraft = {
    ...params,
    held: new Promise((resolve) => {
      release = resolve;
    }),
    requested: false,
  };
  return release;
};

export const draftWasRequested = () => heldDraft?.requested ?? false;

/** Sets the task form's schema until the next test. */
export const setServedSchema = (schema: unknown) => {
  servedSchema = schema;
};

export const readingOnlySchema = {
  pages: [taskSchema.pages[0]],
  outputViews: [],
};

export const submissionCount = () => submissions;

/** localStorage keys other than the flow's own resume position. */
export const storedDraftKeys = () =>
  Array.from({ length: window.localStorage.length }, (_, i) =>
    window.localStorage.key(i),
  ).filter((key) => !key?.startsWith("taskflow-step:"));
