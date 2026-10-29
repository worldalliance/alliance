import { taskFlow, withdrawFromAction } from "@alliance/shared/lib/copy";
import { makeFormResponse } from "@alliance/shared/lib/testFixtures";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { authValue } from "../../testing/authValue";
import ActionTaskPanelForm from "../ActionTaskPanelForm";
import {
  action,
  CLOSE_TIMEOUT,
  openFirstQuestionScreen,
  renderFlow,
  serveTaskFlow,
  storedDraftKeys,
  submissionCount,
  submitFlow,
  taskSchema,
} from "./TaskFlow.testing";

declare const happyDOM: { setURL: (url: string) => void };

serveTaskFlow();

it("runs a staff preview through to the completion card without submitting or storing a draft", async () => {
  renderFlow({
    page: (
      <ActionTaskPanelForm
        taskFormId={9}
        actionId={1}
        onCompleteAction={null}
        onFormStarted={() => {}}
        onDeadlinePassed={() => {}}
        preview
        taskFlowAction={action}
      />
    ),
  });
  await openFirstQuestionScreen();
  fireEvent.change(screen.getByRole("textbox", { name: /First impression/ }), {
    target: { value: "Helpful" },
  });
  fireEvent.click(screen.getByRole("button", { name: taskFlow.next }));
  fireEvent.click(await screen.findByRole("button", { name: taskFlow.submit }));

  expect(
    await screen.findByRole("heading", { name: taskFlow.complete }),
  ).toBeTruthy();
  expect(submissionCount()).toBe(0);
  expect(storedDraftKeys()).toEqual([]);
});

it("walks a task the member can't submit read-only, closing from its last screen", async () => {
  renderFlow({
    page: (
      <ActionTaskPanelForm
        taskFormId={9}
        actionId={1}
        onCompleteAction={null}
        onAbandonAction={() => {}}
        onFormStarted={() => {}}
        onDeadlinePassed={() => {}}
        disabled
        taskFlowAction={action}
      />
    ),
  });
  fireEvent.click(await screen.findByRole("button", { name: taskFlow.view }));
  await screen.findByRole("heading", { name: taskFlow.background });
  expect(screen.queryByRole("button", { name: withdrawFromAction })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: taskFlow.next }));
  await screen.findByRole("heading", { name: "Rate the chatbot" });
  fireEvent.click(screen.getByRole("button", { name: taskFlow.next }));
  fireEvent.click(await screen.findByRole("button", { name: taskFlow.done }));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), {
    timeout: CLOSE_TIMEOUT,
  });
  expect(submissionCount()).toBe(0);
});

it("shows a guest the completion card before completing a public task and redirecting, with no one to invite", async () => {
  const startHref = window.location.href;
  happyDOM.setURL("http://localhost/actions/1");
  const onCompleteAction = jest.fn();
  renderFlow({
    auth: authValue(),
    page: (
      <ActionTaskPanelForm
        taskFormId={9}
        actionId={1}
        onCompleteAction={onCompleteAction}
        onFormStarted={() => {}}
        onDeadlinePassed={() => {}}
        publicAction
        taskFlowAction={action}
      />
    ),
  });
  try {
    await submitFlow();

    expect(submissionCount()).toBe(1);
    expect(onCompleteAction).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/actions/1");
    expect(
      screen.queryByRole("button", { name: taskFlow.inviteFriend }),
    ).toBeNull();
    expect(
      screen.getByText(taskFlow.completeUpdate).nextElementSibling,
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: taskFlow.closeTask }));
    await waitFor(() => expect(onCompleteAction).toHaveBeenCalledTimes(1), {
      timeout: CLOSE_TIMEOUT,
    });
    expect(window.location.pathname).toBe("/actions/completed");
  } finally {
    happyDOM.setURL(startHref);
  }
});

it("offers a guest on a public task no withdraw", async () => {
  renderFlow({
    auth: authValue(),
    page: (
      <ActionTaskPanelForm
        taskFormId={9}
        actionId={1}
        onCompleteAction={() => {}}
        onAbandonAction={() => {}}
        onFormStarted={() => {}}
        onDeadlinePassed={() => {}}
        publicAction
        taskFlowAction={action}
      />
    ),
  });
  fireEvent.click(await screen.findByRole("button", { name: taskFlow.begin }));
  await screen.findByRole("heading", { name: taskFlow.background });
  expect(screen.queryByRole("button", { name: withdrawFromAction })).toBeNull();
});

it("opens a submitted response read-only, with the member's answers", async () => {
  renderFlow({
    page: (
      <ActionTaskPanelForm
        taskFormId={9}
        actionId={1}
        onCompleteAction={() => {}}
        onFormStarted={() => {}}
        onDeadlinePassed={() => {}}
        formResponse={makeFormResponse({
          formId: 9,
          formSnapshotId: 3,
          schemaSnapshot: taskSchema,
          answers: { a: "Helpful" },
        })}
        taskFlowAction={action}
      />
    ),
  });
  fireEvent.click(await screen.findByRole("button", { name: taskFlow.view }));
  await screen.findByRole("heading", { name: taskFlow.background });
  fireEvent.click(screen.getByRole("button", { name: taskFlow.next }));
  await screen.findByRole("heading", { name: "Rate the chatbot" });

  expect(screen.getByDisplayValue("Helpful")).toBeTruthy();
});
