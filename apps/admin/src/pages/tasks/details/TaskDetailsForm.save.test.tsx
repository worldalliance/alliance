import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { LeaveGuardRouter } from "../../../lib/testing/LeaveGuardRouter";
import { makeParsedAction } from "../../../lib/testing/parsedAction";
import { ToastProvider } from "../../../ui/ToastProvider";
import { useActionEditor } from "../../action-dashboard/useActionEditor";
import { testLookups } from "./renderDetailsForm";
import { TaskDetailsForm } from "./TaskDetailsForm";

const action = makeParsedAction({
  shortDescription: "Short",
  body: "[Settings](https://worldalliance.org/settings)",
});

const lookups = testLookups();

const renderDetailsForm = (isNew: boolean) => {
  const createAction = jest.fn(async () => action);
  const updateAction = jest.fn(async () => action);
  const searchParams = new URLSearchParams();
  const setError = jest.fn();
  const Harness = () => {
    const editor = useActionEditor({
      admin: {
        action: isNew ? null : action,
        isFetching: false,
        createAction,
        updateAction,
      },
      actionId: isNew ? null : action.id,
      isNew,
      cohortParseFailed: false,
      lookups,
      searchParams,
      setError,
    });
    return (
      <TaskDetailsForm
        editor={editor}
        lookups={lookups}
        task={isNew ? null : action}
        saving={false}
      />
    );
  };
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>
      <ToastProvider>
        <LeaveGuardRouter>{children}</LeaveGuardRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
  render(<Harness />, { wrapper: Wrapper });
  return isNew ? createAction : updateAction;
};

it.each([
  ["a new task", true],
  ["an existing task", false],
])("shows the worldalliance dialog when saving %s", async (_, isNew) => {
  const save = renderDetailsForm(isNew);
  if (isNew) {
    fireEvent.change(screen.getByLabelText(/^Name/), {
      target: { name: "name", value: "worldalliance action" },
    });
  } else {
    await waitFor(() => expect(screen.getByDisplayValue("Short")).toBeTruthy());
  }

  fireEvent.click(
    screen.getByRole("button", {
      name: isNew ? "Create task" : "Save changes",
    }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Save anyway" }));

  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
});
