import { taskFlow } from "@alliance/shared/lib/copy";
import { fireEvent, screen } from "@testing-library/react";
import {
  backgroundOnlySchema,
  renderFlow,
  serveTaskFlow,
  setServedSchema,
  setSubmitStatus,
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
