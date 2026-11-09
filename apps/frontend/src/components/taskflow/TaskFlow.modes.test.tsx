import {
  taskFlow,
  taskFlowFallbackTitle,
  withdrawFromAction,
} from "@alliance/shared/lib/copy";
import { makeFormResponse } from "@alliance/shared/lib/testFixtures";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { testAuthUser } from "../../stories/testData";
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
        onCompleteAction={null}
        onFormStarted={() => {}}
        onDeadlinePassed={() => {}}
        preview
        action={action}
      />
    ),
  });
  await openFirstQuestionScreen();
  expect(screen.queryByText(taskFlow.progressSaved)).toBeNull();
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
        onCompleteAction={null}
        onAbandonAction={() => {}}
        onFormStarted={() => {}}
        onDeadlinePassed={() => {}}
        disabled
        action={action}
      />
    ),
  });
  const greyView = await screen.findByRole("button", { name: taskFlow.view });
  expect(greyView.className).toContain("bg-zinc-200");
  fireEvent.click(greyView);
  await screen.findByRole("heading", { name: taskFlowFallbackTitle.reading });
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
        onCompleteAction={onCompleteAction}
        onFormStarted={() => {}}
        onDeadlinePassed={() => {}}
        publicAction
        action={action}
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
    // The guest's hard redirect, not a client-side navigation it could race.
    expect(screen.getByText("at /actions/1 default")).toBeTruthy();
    expect(window.location.pathname).toBe("/actions/completed");
  } finally {
    happyDOM.setURL(startHref);
  }
});

it("offers a referred guest signup in place of an invite, completing the task on the way", async () => {
  const onSubmitted = jest.fn();
  renderFlow({
    auth: authValue(),
    page: (
      <ActionTaskPanelForm
        taskFormId={9}
        onCompleteAction={() => {}}
        onFormStarted={() => {}}
        onDeadlinePassed={() => {}}
        publicAction
        redirectOnComplete={false}
        onSubmitted={onSubmitted}
        signupHref="/signup?ref=abc"
        action={action}
      />
    ),
  });
  await submitFlow();
  expect(
    screen.queryByRole("button", { name: taskFlow.inviteFriend }),
  ).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: taskFlow.joinAlliance }));

  expect(await screen.findByText("Signup")).toBeTruthy();
  expect(onSubmitted).toHaveBeenCalledTimes(1);
});

it("offers a guest on a public task no withdraw", async () => {
  renderFlow({
    auth: authValue(),
    page: (
      <ActionTaskPanelForm
        taskFormId={9}
        onCompleteAction={() => {}}
        onAbandonAction={() => {}}
        onFormStarted={() => {}}
        onDeadlinePassed={() => {}}
        publicAction
        action={action}
      />
    ),
  });
  fireEvent.click(await screen.findByRole("button", { name: taskFlow.begin }));
  await screen.findByRole("heading", { name: taskFlowFallbackTitle.reading });
  expect(screen.queryByRole("button", { name: withdrawFromAction })).toBeNull();
});

it("opens a submitted response read-only, with the member's answers", async () => {
  renderFlow({
    page: (
      <ActionTaskPanelForm
        taskFormId={9}
        onCompleteAction={() => {}}
        onFormStarted={() => {}}
        onDeadlinePassed={() => {}}
        formResponse={makeFormResponse({
          formId: 9,
          formSnapshotId: 3,
          schemaSnapshot: taskSchema,
          answers: { a: "Helpful" },
        })}
        action={action}
      />
    ),
  });
  fireEvent.click(await screen.findByRole("button", { name: taskFlow.view }));
  await screen.findByRole("heading", { name: taskFlowFallbackTitle.reading });
  fireEvent.click(screen.getByRole("button", { name: taskFlow.next }));
  await screen.findByRole("heading", { name: "Rate the chatbot" });

  expect(screen.getByDisplayValue("Helpful")).toBeTruthy();
});

it("shows a submitted task's answers card under its View task button", async () => {
  renderFlow({
    page: (
      <ActionTaskPanelForm
        taskFormId={9}
        onCompleteAction={() => {}}
        onFormStarted={() => {}}
        onDeadlinePassed={() => {}}
        formResponse={makeFormResponse({
          formId: 9,
          formSnapshotId: 3,
          schemaSnapshot: {
            ...taskSchema,
            outputViews: [
              {
                type: "default",
                id: "v1",
                blocks: [{ id: "b1", fieldId: "a", showLabel: true }],
              },
            ],
          },
          answers: { a: "Helpful" },
        })}
        action={action}
      />
    ),
  });

  const view = await screen.findByRole("button", { name: taskFlow.view });
  const name = await screen.findByText(testAuthUser.name);
  expect(
    view.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

it("resolves a random-backed variable in the answers card it shows", async () => {
  renderFlow({
    page: (
      <ActionTaskPanelForm
        taskFormId={9}
        onCompleteAction={() => {}}
        onFormStarted={() => {}}
        onDeadlinePassed={() => {}}
        formResponse={makeFormResponse({
          formId: 9,
          formSnapshotId: 3,
          schemaSnapshot: {
            ...taskSchema,
            variables: [
              {
                name: "pick",
                inputs: { input1: { kind: "random" } },
                formula: '["Red"][input1 % 1]',
              },
            ],
            outputViews: [
              {
                type: "default",
                id: "v1",
                blocks: [
                  {
                    id: "b1",
                    type: "display",
                    kind: "text",
                    text: "Your pick: #{pick}",
                  },
                ],
              },
            ],
          },
          answers: { a: "Helpful" },
        })}
        action={action}
      />
    ),
  });

  expect(await screen.findByText("Your pick: Red")).toBeTruthy();
});
