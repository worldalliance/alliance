import { useActionHandlers } from "@alliance/shared/lib/actionPage";
import { actionStore } from "@alliance/shared/lib/actionStore";
import {
  hasViewerCompletedAction,
  withOptimisticRelation,
} from "@alliance/shared/lib/actionUtils";
import { taskFlow, withdrawFromAction } from "@alliance/shared/lib/copy";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { makeAction } from "@alliance/shared/lib/testFixtures";
import { seedActions } from "@alliance/shared/lib/testing/seedActions";
import { QueryClient } from "@tanstack/react-query";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { useLocation } from "react-router";
import ActionTaskPanelForm from "../ActionTaskPanelForm";
import {
  action,
  backgroundOnlySchema,
  CLOSE_TIMEOUT,
  holdSubmit,
  navigate,
  openFirstQuestionScreen,
  renderFlow,
  serveTaskFlow,
  setServedSchema,
  setServerAction,
  setSubmitStatus,
  submitFlow,
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

it("opens the project background, then screens of at most two questions", async () => {
  renderFlow();

  fireEvent.click(await screen.findByRole("button", { name: taskFlow.begin }));

  expect(
    await screen.findByRole("heading", { name: taskFlow.background }),
  ).toBeTruthy();
  expect(screen.getByText("Why this project matters")).toBeTruthy();
  expect(screen.getByText("Sam Reviewer")).toBeTruthy();
  expect(screen.getByText("Expert")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByRole("heading", { name: "Rate the chatbot" });
  expect(screen.getAllByRole("textbox")).toHaveLength(2);
});

it("keeps the member on a screen until its required answers are in", async () => {
  renderFlow();
  await openFirstQuestionScreen();

  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: /First impression/ })).toBe(
      document.activeElement,
    ),
  );
  expect(screen.getAllByRole("textbox")).toHaveLength(2);

  fireEvent.change(screen.getByRole("textbox", { name: /First impression/ }), {
    target: { value: "Helpful" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: /Anything else/ })).toBeTruthy(),
  );
});

it("stays on the last screen with the error when the submit fails", async () => {
  setSubmitStatus(500);
  const onCompleteAction = jest.fn();
  renderFlow({ onCompleteAction });
  await openFirstQuestionScreen();
  fireEvent.change(screen.getByRole("textbox", { name: /First impression/ }), {
    target: { value: "Helpful" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(await screen.findByRole("button", { name: "Submit" }));

  expect(await screen.findByText("Failed to submit action.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Submit" })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: taskFlow.complete })).toBeNull();
  expect(onCompleteAction).not.toHaveBeenCalled();
});

it("shows why a broken form can't open in place of its screens", async () => {
  setServedSchema({
    ...backgroundOnlySchema,
    variables: [{ name: "total", inputs: {}, formula: "this" }],
  });
  renderFlow();
  fireEvent.click(await screen.findByRole("button", { name: taskFlow.begin }));

  expect(await screen.findByText("This form can't be displayed")).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: taskFlow.background }),
  ).toBeNull();
});

it("stays open while the submit is in flight", async () => {
  const release = holdSubmit();
  renderFlow();
  await openFirstQuestionScreen();
  fireEvent.change(screen.getByRole("textbox", { name: /First impression/ }), {
    target: { value: "Helpful" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  fireEvent.click(await screen.findByRole("button", { name: "Submit" }));

  const close = screen.getByRole("button", { name: taskFlow.closeTask });
  await waitFor(() => expect(close).toHaveProperty("disabled", true));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  release();

  expect(
    await screen.findByRole("heading", { name: taskFlow.complete }),
  ).toBeTruthy();
});

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

  fireEvent.click(screen.getByRole("button", { name: taskFlow.closeTask }));

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

  fireEvent.click(screen.getByRole("button", { name: taskFlow.closeTask }));
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
  fireEvent.click(await screen.findByRole("button", { name: "Submit" }));
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

it("turns the nav back from green before the completion card shrinks away", async () => {
  renderFlow();
  await submitFlow();
  expect(screen.getByText("nav green")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: taskFlow.closeTask }));

  expect(await screen.findByText("nav plain")).toBeTruthy();
  expect(screen.getByText("nav collapsed")).toBeTruthy();
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(
    await screen.findByText("nav expanded", {}, { timeout: CLOSE_TIMEOUT }),
  ).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("reopens the screen the member navigated away from when they come back", async () => {
  renderFlow();
  await openFirstQuestionScreen();

  act(() => navigate("/forum"));
  await screen.findByText("Forum");

  act(() => navigate(-1));

  expect(
    await screen.findByRole("heading", { name: "Rate the chatbot" }),
  ).toBeTruthy();
});

it("doesn't reopen on the task's page a flow left from the home card", async () => {
  renderFlow({ path: "/" });
  await openFirstQuestionScreen();

  act(() => navigate("/forum"));
  await screen.findByText("Forum");
  act(() => navigate("/actions/1"));

  expect(
    await screen.findByRole("button", { name: taskFlow.begin }),
  ).toBeTruthy();
  await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(
    screen.queryByRole("heading", { name: "Rate the chatbot" }),
  ).toBeNull();
});

function TogglePanel() {
  const [shown, setShown] = useState(true);
  return (
    <>
      <button onClick={() => setShown(!shown)}>Toggle panel</button>
      {shown ? (
        <ActionTaskPanelForm
          taskFormId={9}
          onCompleteAction={() => {}}
          onFormStarted={() => {}}
          onDeadlinePassed={() => {}}
          action={action}
        />
      ) : null}
    </>
  );
}

it("doesn't reopen a flow that unmounted without the member leaving the page", async () => {
  window.happyDOM.setURL("http://localhost/actions/1");
  try {
    renderFlow({ page: <TogglePanel /> });
    await openFirstQuestionScreen();

    fireEvent.click(screen.getByRole("button", { name: "Toggle panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle panel" }));

    expect(
      await screen.findByRole("button", { name: taskFlow.begin }),
    ).toBeTruthy();
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    expect(
      screen.queryByRole("heading", { name: "Rate the chatbot" }),
    ).toBeNull();
  } finally {
    window.happyDOM.setURL("about:blank");
  }
});

it("collapses the nav while the flow is open", async () => {
  renderFlow();
  expect(await screen.findByText("nav expanded")).toBeTruthy();

  await openFirstQuestionScreen();
  expect(screen.getByText("nav collapsed")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: taskFlow.closeTask }));
  expect(await screen.findByText("nav expanded")).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

function PanelForRoute() {
  const actionId = useLocation().pathname === "/actions/2" ? 2 : 1;
  return (
    <ActionTaskPanelForm
      taskFormId={9}
      onCompleteAction={() => {}}
      onFormStarted={() => {}}
      onDeadlinePassed={() => {}}
      action={makeAction({ id: actionId, name: `Task ${actionId}` })}
    />
  );
}

it("starts closed on another action's page rather than carrying the flow over", async () => {
  renderFlow({ page: <PanelForRoute /> });
  await openFirstQuestionScreen();

  act(() => navigate("/actions/2"));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByRole("button", { name: taskFlow.begin })).toBeTruthy();
});

const openWithdrawMenu = async (onAbandonAction: () => void = () => {}) => {
  renderFlow({
    page: (
      <ActionTaskPanelForm
        taskFormId={9}
        onCompleteAction={() => {}}
        onAbandonAction={onAbandonAction}
        onFormStarted={() => {}}
        onDeadlinePassed={() => {}}
        action={action}
      />
    ),
  });
  fireEvent.click(await screen.findByRole("button", { name: taskFlow.begin }));
  await screen.findByRole("heading", { name: taskFlow.background });
  fireEvent.click(screen.getByRole("button", { name: withdrawFromAction }));
};

it("closes the flow and forgets its screen when the member withdraws", async () => {
  const onAbandonAction = jest.fn();
  await openWithdrawMenu(onAbandonAction);
  fireEvent.click(
    screen.getByRole("button", { name: "Took more than 15 minutes" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));

  await waitFor(() => expect(onAbandonAction).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(await screen.findByText("nav expanded")).toBeTruthy();
  expect(window.localStorage.getItem("taskflow-screen:9")).toBeNull();
});

it("closes only the withdraw menu when Escape dismisses it", async () => {
  await openWithdrawMenu();

  fireEvent.keyDown(screen.getByRole("button", { name: withdrawFromAction }), {
    key: "Escape",
  });

  expect(screen.queryByText("Withdrawal options")).toBeNull();
  await act(() => new Promise((resolve) => setTimeout(resolve, CLOSE_TIMEOUT)));
  expect(screen.getByRole("dialog")).toBeTruthy();
});
