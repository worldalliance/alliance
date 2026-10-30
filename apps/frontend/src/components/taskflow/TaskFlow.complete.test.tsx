import { useActionHandlers } from "@alliance/shared/lib/actionPage";
import { actionStore } from "@alliance/shared/lib/actionStore";
import {
  hasViewerCompletedAction,
  withOptimisticRelation,
} from "@alliance/shared/lib/actionUtils";
import { taskFlow } from "@alliance/shared/lib/copy";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { makeAction } from "@alliance/shared/lib/testFixtures";
import { seedActions } from "@alliance/shared/lib/testing/seedActions";
import { QueryClient } from "@tanstack/react-query";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { testAuthUser } from "../../stories/testData";
import ActionTaskPanelForm from "../ActionTaskPanelForm";
import {
  action,
  CLOSE_TIMEOUT,
  holdSubmit,
  navigate,
  openFirstQuestionScreen,
  renderFlow,
  serveTaskFlow,
  setServedSchema,
  setServerAction,
  submitFlow,
  taskSchema,
} from "./TaskFlow.testing";

serveTaskFlow();

/** The action page's panel: the flow until the action reads as completed. */
function ActionPagePanel() {
  const { action: pageAction, onCompleteAction } = useActionHandlers(
    1,
    true,
    () => {},
  );
  if (!pageAction) return null;
  if (hasViewerCompletedAction(pageAction)) return <p>Completed panel</p>;
  return (
    <ActionTaskPanelForm
      taskFormId={9}
      onCompleteAction={() => void onCompleteAction()}
      onFormStarted={() => {}}
      onDeadlinePassed={() => {}}
      action={pageAction}
    />
  );
}

it("completes the action only once the member closes the completion card", async () => {
  const onCompleteAction = jest.fn();
  const queryClient = new QueryClient();
  seedActions(queryClient, [makeAction({ id: 1 })]);
  renderFlow({ onCompleteAction, queryClient });
  await submitFlow();

  expect(onCompleteAction).not.toHaveBeenCalled();
  expect(actionStore(queryClient).get(1)?.viewer?.relation).not.toBe(
    "completed",
  );

  fireEvent.click(screen.getByRole("button", { name: taskFlow.viewTasks }));

  await waitFor(() => expect(onCompleteAction).toHaveBeenCalledTimes(1), {
    timeout: CLOSE_TIMEOUT,
  });
  expect(actionStore(queryClient).get(1)?.viewer?.relation).toBe("completed");
});

it("keeps the completion card up when a refetch reports the action completed", async () => {
  const queryClient = new QueryClient();
  renderFlow({ queryClient, page: <ActionPagePanel /> });
  await submitFlow();

  setServerAction(withOptimisticRelation(action, "completed"));
  await act(async () => {
    await queryClient.refetchQueries({ queryKey: queryKeys.action(1) });
    await new Promise((resolve) => setTimeout(resolve, 10));
  });

  expect(screen.getByRole("heading", { name: taskFlow.complete })).toBeTruthy();
  expect(screen.queryByText("Completed panel")).toBeNull();

  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(
    await screen.findByText("Completed panel", {}, { timeout: CLOSE_TIMEOUT }),
  ).toBeTruthy();
});

it("completes the action when Escape closes the completion card", async () => {
  const onCompleteAction = jest.fn();
  renderFlow({ onCompleteAction });
  await submitFlow();

  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

  await waitFor(() => expect(onCompleteAction).toHaveBeenCalledTimes(1), {
    timeout: CLOSE_TIMEOUT,
  });
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("completes the action when the member leaves the completion card through the nav", async () => {
  const onCompleteAction = jest.fn();
  renderFlow({ onCompleteAction });
  await submitFlow();

  act(() => navigate("/forum"));
  await screen.findByText("Forum");

  expect(onCompleteAction).toHaveBeenCalledTimes(1);
});

it("completes the action when the member leaves through the nav mid-submit", async () => {
  const release = holdSubmit();
  const onCompleteAction = jest.fn();
  renderFlow({ onCompleteAction });
  await openFirstQuestionScreen();
  fireEvent.change(screen.getByRole("textbox", { name: /First impression/ }), {
    target: { value: "Helpful" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(await screen.findByRole("button", { name: taskFlow.submit }));
  const close = screen.getByRole("button", { name: taskFlow.closeTask });
  await waitFor(() => expect(close).toHaveProperty("disabled", true));

  act(() => navigate("/forum"));
  await screen.findByText("Forum");
  release();
  await waitFor(() => expect(onCompleteAction).toHaveBeenCalledTimes(1));

  act(() => navigate("/actions/1"));
  expect(
    await screen.findByRole("button", { name: taskFlow.begin }),
  ).toBeTruthy();
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("goes to the tasks homepage from the completion card's View tasks", async () => {
  const onCompleteAction = jest.fn();
  renderFlow({ onCompleteAction });
  await submitFlow();

  fireEvent.click(screen.getByRole("button", { name: taskFlow.viewTasks }));

  expect(
    await screen.findByText("Tasks home", {}, { timeout: CLOSE_TIMEOUT }),
  ).toBeTruthy();
  expect(onCompleteAction).toHaveBeenCalledTimes(1);
});

it("only closes on the tasks homepage from the completion card's View tasks", async () => {
  const onCompleteAction = jest.fn();
  renderFlow({ onCompleteAction, path: "/tasks" });
  await submitFlow();

  fireEvent.click(screen.getByRole("button", { name: taskFlow.viewTasks }));

  await waitFor(() => expect(onCompleteAction).toHaveBeenCalledTimes(1), {
    timeout: CLOSE_TIMEOUT,
  });
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("goes straight to the invites page from the completion card, completing the task", async () => {
  const onCompleteAction = jest.fn();
  renderFlow({ onCompleteAction });
  await submitFlow();

  fireEvent.click(screen.getByRole("button", { name: taskFlow.inviteFriend }));

  expect(screen.getByText("Invites")).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(onCompleteAction).toHaveBeenCalledTimes(1);
  expect(await screen.findByText("nav expanded")).toBeTruthy();
});

it("shows the member's answers card on completion only with an output view", async () => {
  renderFlow();
  await submitFlow();
  expect(screen.queryByText(testAuthUser.name)).toBeNull();
});

it("shows the member's answers card on completion from the output view", async () => {
  setServedSchema({
    ...taskSchema,
    outputViews: [
      {
        type: "default",
        id: "v1",
        blocks: [{ id: "b1", fieldId: "a", showLabel: true }],
      },
    ],
  });
  renderFlow();
  await submitFlow();
  expect(screen.getByText(testAuthUser.name)).toBeTruthy();
});

it("closes the completion screen on a tap on its background, not its text", async () => {
  const onCompleteAction = jest.fn();
  renderFlow({ onCompleteAction, path: "/tasks" });
  await submitFlow();

  fireEvent.click(screen.getByRole("heading", { name: taskFlow.complete }));
  fireEvent.click(screen.getByText(taskFlow.completeUpdate));
  await act(() => new Promise((resolve) => setTimeout(resolve, CLOSE_TIMEOUT)));
  expect(onCompleteAction).not.toHaveBeenCalled();

  const background = screen.getByText(taskFlow.completeUpdate).parentElement;
  if (!background) throw new Error("completion text has no container");
  fireEvent.click(background);
  await waitFor(() => expect(onCompleteAction).toHaveBeenCalledTimes(1), {
    timeout: CLOSE_TIMEOUT,
  });
});

it("turns the nav back from green before the completion card shrinks away", async () => {
  renderFlow();
  await submitFlow();
  expect(screen.getByText("nav green")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: taskFlow.viewTasks }));

  expect(await screen.findByText("nav plain")).toBeTruthy();
  expect(screen.getByText("nav collapsed")).toBeTruthy();
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(
    await screen.findByText("nav expanded", {}, { timeout: CLOSE_TIMEOUT }),
  ).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
