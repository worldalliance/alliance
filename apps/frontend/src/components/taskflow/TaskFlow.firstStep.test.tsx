import type { FormResponseDto } from "@alliance/shared/client";
import { taskFlow, taskFlowFallbackTitle } from "@alliance/shared/lib/copy";
import { makeFormResponse } from "@alliance/shared/lib/testFixtures";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import ActionTaskPanelForm from "../ActionTaskPanelForm";
import {
  action,
  CLOSE_TIMEOUT,
  readingOnlySchema,
  renderFlow,
  serveTaskFlow,
  setServedSchema,
  setSubmitStatus,
  submitFlow,
  taskSchema,
} from "./TaskFlow.testing";

serveTaskFlow();

const openFirstStep = async () => {
  fireEvent.click(await screen.findByRole("button", { name: taskFlow.begin }));
  await screen.findByRole("heading", { name: taskFlowFallbackTitle.reading });
};

it("submits a one-page form that asks nothing from its only step", async () => {
  setServedSchema(readingOnlySchema);
  const onCompleteAction = jest.fn();
  renderFlow({ onCompleteAction });
  await openFirstStep();

  fireEvent.click(screen.getByRole("button", { name: taskFlow.submit }));

  expect(
    await screen.findByRole("heading", { name: taskFlow.complete }),
  ).toBeTruthy();
  expect(onCompleteAction).not.toHaveBeenCalled();
});

it("keeps the step with the error when its submit fails", async () => {
  setServedSchema(readingOnlySchema);
  setSubmitStatus(500);
  renderFlow();
  await openFirstStep();

  fireEvent.click(screen.getByRole("button", { name: taskFlow.submit }));

  expect(await screen.findByText("Failed to submit action.")).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: taskFlowFallbackTitle.reading }),
  ).toBeTruthy();
  expect(screen.queryByRole("heading", { name: taskFlow.complete })).toBeNull();
});

it("closes a read-only one-page form from its only step's Done", async () => {
  setServedSchema(readingOnlySchema);
  renderFlow({
    page: (
      <ActionTaskPanelForm
        taskFormId={9}
        onCompleteAction={null}
        onFormStarted={() => {}}
        onDeadlinePassed={() => {}}
        disabled
        action={action}
      />
    ),
  });
  fireEvent.click(await screen.findByRole("button", { name: taskFlow.view }));
  await screen.findByRole("heading", { name: taskFlowFallbackTitle.reading });

  fireEvent.click(screen.getByRole("button", { name: taskFlow.done }));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), {
    timeout: CLOSE_TIMEOUT,
  });
});

function PanelShowingItsSubmission() {
  const [response, setResponse] = useState<FormResponseDto>();
  return (
    <ActionTaskPanelForm
      taskFormId={9}
      onCompleteAction={() =>
        setResponse(
          makeFormResponse({
            formId: 9,
            formSnapshotId: 3,
            schemaSnapshot: taskSchema,
          }),
        )
      }
      onFormStarted={() => {}}
      onDeadlinePassed={() => {}}
      formResponse={response}
      action={action}
    />
  );
}

it("opens a task just submitted through the flow on its first step", async () => {
  renderFlow({ page: <PanelShowingItsSubmission /> });
  await submitFlow();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

  await screen.findByRole(
    "button",
    { name: taskFlow.view },
    { timeout: CLOSE_TIMEOUT },
  );

  // Begin opens nothing until the remounted form's visibility settles.
  await waitFor(() => {
    if (
      !screen.queryByRole("heading", { name: taskFlowFallbackTitle.reading })
    ) {
      fireEvent.click(screen.getByRole("button", { name: taskFlow.view }));
    }
    expect(
      screen.getByRole("heading", { name: taskFlowFallbackTitle.reading }),
    ).toBeTruthy();
  });
});

it("titles an opening page that asks nothing with its own header, shown once", async () => {
  setServedSchema({
    ...taskSchema,
    pages: [
      {
        id: "p1",
        fields: [
          { id: "bh", type: "display", kind: "header", text: "Why it matters" },
          ...taskSchema.pages[0].fields,
        ],
      },
      ...taskSchema.pages.slice(1),
    ],
  });
  renderFlow();
  fireEvent.click(await screen.findByRole("button", { name: taskFlow.begin }));

  expect(
    await screen.findAllByRole("heading", { name: "Why it matters" }),
  ).toHaveLength(1);
  expect(
    screen.queryByRole("heading", { name: taskFlowFallbackTitle.reading }),
  ).toBeNull();
});
