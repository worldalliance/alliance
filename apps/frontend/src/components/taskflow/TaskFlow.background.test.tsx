import type { FormResponseDto } from "@alliance/shared/client";
import { taskFlow } from "@alliance/shared/lib/copy";
import { makeFormResponse } from "@alliance/shared/lib/testFixtures";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import ActionTaskPanelForm from "../ActionTaskPanelForm";
import {
  action,
  backgroundOnlySchema,
  CLOSE_TIMEOUT,
  renderFlow,
  serveTaskFlow,
  setServedSchema,
  setSubmitStatus,
  submitFlow,
  taskSchema,
} from "./TaskFlow.testing";

serveTaskFlow();

const openBackground = async () => {
  fireEvent.click(await screen.findByRole("button", { name: taskFlow.begin }));
  await screen.findByRole("heading", { name: taskFlow.background });
};

it("submits a background-only form from the background page's Submit", async () => {
  setServedSchema(backgroundOnlySchema);
  const onCompleteAction = jest.fn();
  renderFlow({ onCompleteAction });
  await openBackground();

  fireEvent.click(screen.getByRole("button", { name: taskFlow.submit }));

  expect(
    await screen.findByRole("heading", { name: taskFlow.complete }),
  ).toBeTruthy();
  expect(onCompleteAction).not.toHaveBeenCalled();
});

it("keeps the background page with the error when its submit fails", async () => {
  setServedSchema(backgroundOnlySchema);
  setSubmitStatus(500);
  renderFlow();
  await openBackground();

  fireEvent.click(screen.getByRole("button", { name: taskFlow.submit }));

  expect(await screen.findByText("Failed to submit action.")).toBeTruthy();
  expect(
    screen.getByRole("heading", { name: taskFlow.background }),
  ).toBeTruthy();
  expect(screen.queryByRole("heading", { name: taskFlow.complete })).toBeNull();
});

it("closes a read-only background-only form from the background page's Done", async () => {
  setServedSchema(backgroundOnlySchema);
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
  await screen.findByRole("heading", { name: taskFlow.background });

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

it("opens a task just submitted through the flow on its project background", async () => {
  renderFlow({ page: <PanelShowingItsSubmission /> });
  await submitFlow();
  fireEvent.click(screen.getByRole("button", { name: taskFlow.closeTask }));

  await screen.findByRole(
    "button",
    { name: taskFlow.view },
    { timeout: CLOSE_TIMEOUT },
  );

  // Begin opens nothing until the remounted form's visibility settles.
  await waitFor(() => {
    if (!screen.queryByRole("heading", { name: taskFlow.background })) {
      fireEvent.click(screen.getByRole("button", { name: taskFlow.view }));
    }
    expect(
      screen.getByRole("heading", { name: taskFlow.background }),
    ).toBeTruthy();
  });
});
