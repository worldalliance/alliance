import { makeAction } from "@alliance/shared/lib/testFixtures";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { act, render, waitFor } from "@testing-library/react";
import type React from "react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
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
