import { makeAction } from "@alliance/shared/lib/testFixtures";
import * as readFileDataUriModule from "@alliance/sharedweb/lib/readFileDataUri";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type React from "react";
import {
  createMemoryRouter,
  Outlet,
  RouterProvider,
  useParams,
} from "react-router";
import LeaveGuard from "../../components/LeaveGuard";
import { makeParsedAction } from "../../lib/testing/parsedAction";
import { type ActionEditorState, useActionEditor } from "./useActionEditor";

const noSearchParams = new URLSearchParams();
const setError = jest.fn();
// handleSubmit only calls preventDefault on the event.
const submitEvent = { preventDefault: () => {} } as React.FormEvent;
const existing = makeParsedAction({ id: 7 });

/** The action editor at `path`, under the admin layout's LeaveGuard. */
const renderEditorAt = (path: "/actions/new" | "/actions/7") => {
  const isNew = path === "/actions/new";
  let editor!: ActionEditorState;
  const Editor = () => {
    editor = useActionEditor({
      admin: {
        action: isNew ? null : existing,
        isFetching: false,
        createAction: jest.fn().mockResolvedValue(makeAction({ id: 9 })),
        updateAction: jest.fn(async () => existing),
      },
      actionId: isNew ? null : existing.id,
      isNew,
      cohortParseFailed: false,
      lookups: {
        availableSuites: [],
        suitesLoading: false,
        suitesError: false,
      },
      searchParams: noSearchParams,
      setError,
    });
    return (
      <>
        {editor.contentDialog}
        <input
          type="file"
          aria-label="Cover image"
          onChange={editor.handleImageChange}
        />
      </>
    );
  };
  const router = createMemoryRouter(
    [
      {
        element: (
          <ToastProvider>
            <LeaveGuard>
              <Outlet />
            </LeaveGuard>
          </ToastProvider>
        ),
        children: [
          { path, element: <Editor /> },
          { path: "/actions/:actionId", element: null },
          { path: "/projects", element: null },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return { router, editor: () => editor };
};

it("asks before an edited new action is left, and opens the created action unasked", async () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  const { router, editor } = renderEditorAt("/actions/new");
  await waitFor(() => expect(editor().dirty).toBe(false));

  act(() => editor().handleCohortExpressionChange({ type: "AllMembers" }));
  await act(() => router.navigate("/projects"));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(router.state.location.pathname).toBe("/actions/new");

  await act(() => editor().handleSubmit(submitEvent));
  expect(router.state.location.pathname).toBe("/actions/9");
  expect(confirm).toHaveBeenCalledTimes(1);
});

it("leaves staff on the action they moved to when a new action's create resolves late", async () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
  let finishCreate!: (created: ReturnType<typeof makeAction>) => void;
  const createAction = jest
    .fn()
    .mockReturnValue(new Promise((resolve) => (finishCreate = resolve)));
  let editor!: ActionEditorState;
  const Editor = () => {
    const param = useParams().actionId;
    const isNew = param === "new";
    editor = useActionEditor({
      admin: {
        action: isNew ? null : existing,
        isFetching: false,
        createAction,
        updateAction: jest.fn(async () => existing),
      },
      actionId: isNew ? null : Number(param),
      isNew,
      cohortParseFailed: false,
      lookups: {
        availableSuites: [],
        suitesLoading: false,
        suitesError: false,
      },
      searchParams: noSearchParams,
      setError,
    });
    return editor.contentDialog;
  };
  const router = createMemoryRouter(
    [
      {
        element: (
          <ToastProvider>
            <LeaveGuard>
              <Outlet />
            </LeaveGuard>
          </ToastProvider>
        ),
        children: [{ path: "/actions/:actionId", element: <Editor /> }],
      },
    ],
    { initialEntries: ["/actions/new"] },
  );
  render(<RouterProvider router={router} />);
  const rename = (value: string) =>
    act(() =>
      // handleInputChange reads only the event's target.
      editor.handleInputChange({
        target: { name: "name", value, type: "text" },
      } as React.ChangeEvent<HTMLInputElement>),
    );
  await waitFor(() => expect(editor.dirty).toBe(false));
  rename("Call your rep");
  let created!: Promise<void>;
  act(() => {
    created = editor.handleSubmit(submitEvent);
  });
  await waitFor(() => expect(createAction).toHaveBeenCalled());

  await act(() => router.navigate("/actions/7"));
  await waitFor(() => expect(editor.draftSeeded).toBe(true));
  rename("Write to your rep");
  await act(async () => {
    finishCreate(makeAction({ id: 9 }));
    await created;
  });

  expect(router.state.location.pathname).toBe("/actions/7");
  expect(editor.dirty).toBe(true);
  expect(confirm).toHaveBeenCalledTimes(1);
});

it("asks before a change of search params resets an edited new action", async () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  const { router, editor } = renderEditorAt("/actions/new");
  await waitFor(() => expect(editor().dirty).toBe(false));

  act(() => editor().handleCohortExpressionChange({ type: "AllMembers" }));
  await act(() => router.navigate("/actions/new?suiteId=3"));

  expect(confirm).toHaveBeenCalledTimes(1);
  expect(router.state.location.search).toBe("");
});

it("keeps an existing action's draft through a tab change without asking, and asks on leaving", async () => {
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  const { router, editor } = renderEditorAt("/actions/7");
  await waitFor(() => expect(editor().draftSeeded).toBe(true));
  act(() => editor().handleCohortExpressionChange({ type: "AllMembers" }));

  await act(() => router.navigate("/actions/7?tab=events"));
  expect(confirm).not.toHaveBeenCalled();
  expect(editor().dirty).toBe(true);

  await act(() => router.navigate("/projects"));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(router.state.location.pathname).toBe("/actions/7");
});

it("asks before leaving while a cover image is still uploading", async () => {
  jest
    .spyOn(readFileDataUriModule, "readFileDataUri")
    .mockReturnValue(new Promise(() => {}));
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(false);
  const { router, editor } = renderEditorAt("/actions/7");
  await waitFor(() => expect(editor().draftSeeded).toBe(true));

  fireEvent.change(screen.getByLabelText("Cover image"), {
    target: { files: [new File(["x"], "cover.png", { type: "image/png" })] },
  });
  expect(editor().dirty).toBe(false);
  await act(() => router.navigate("/projects"));

  expect(confirm).toHaveBeenCalledTimes(1);
  expect(router.state.location.pathname).toBe("/actions/7");
});

it("stops asking about a left action's upload while the next action loads", async () => {
  jest
    .spyOn(readFileDataUriModule, "readFileDataUri")
    .mockReturnValue(new Promise(() => {}));
  const confirm = jest.spyOn(window, "confirm").mockReturnValue(true);
  const Editor = () => {
    const actionId = Number(useParams().actionId);
    const editor = useActionEditor({
      admin: {
        action: actionId === existing.id ? existing : null,
        isFetching: actionId !== existing.id,
        createAction: jest.fn(),
        updateAction: jest.fn(async () => existing),
      },
      actionId,
      isNew: false,
      cohortParseFailed: false,
      lookups: {
        availableSuites: [],
        suitesLoading: false,
        suitesError: false,
      },
      searchParams: noSearchParams,
      setError,
    });
    return (
      <input
        type="file"
        aria-label="Cover image"
        disabled={!editor.draftSeeded}
        onChange={editor.handleImageChange}
      />
    );
  };
  const router = createMemoryRouter(
    [
      {
        element: (
          <ToastProvider>
            <LeaveGuard>
              <Outlet />
            </LeaveGuard>
          </ToastProvider>
        ),
        children: [
          { path: "/actions/:actionId", element: <Editor /> },
          { path: "/projects", element: null },
        ],
      },
    ],
    { initialEntries: ["/actions/7"] },
  );
  render(<RouterProvider router={router} />);
  await waitFor(() =>
    expect(
      screen.getByLabelText<HTMLInputElement>("Cover image").disabled,
    ).toBe(false),
  );
  fireEvent.change(screen.getByLabelText("Cover image"), {
    target: { files: [new File(["x"], "cover.png", { type: "image/png" })] },
  });

  await act(() => router.navigate("/actions/8"));
  expect(confirm).toHaveBeenCalledTimes(1);
  await act(() => router.navigate("/projects"));

  expect(confirm).toHaveBeenCalledTimes(1);
  expect(router.state.location.pathname).toBe("/projects");
});
