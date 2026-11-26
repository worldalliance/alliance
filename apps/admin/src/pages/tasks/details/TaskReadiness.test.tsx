import { fireEvent, render, screen } from "@testing-library/react";
import { makeParsedAction } from "../../../lib/testing/parsedAction";
import { TaskReadiness } from "./TaskReadiness";

const taskFormQuery = (state: { isLoadingError: boolean }) => ({
  data: undefined,
  isFetching: false,
  error: null,
  refetch: jest.fn(),
  ...state,
});

describe("TaskReadiness", () => {
  it("marks the task form's items as loading, not unfinished, until the form loads", () => {
    render(
      <TaskReadiness
        task={makeParsedAction({ taskFormId: 3 })}
        taskForm={taskFormQuery({ isLoadingError: false })}
      />,
    );

    expect(screen.getAllByText("Loading…")).toHaveLength(2);
    screen.getByText("Total reading time: —");
  });

  it("says when the task form couldn't load, and retries it", () => {
    const taskForm = taskFormQuery({ isLoadingError: true });
    render(
      <TaskReadiness
        task={makeParsedAction({ taskFormId: 3 })}
        taskForm={taskForm}
      />,
    );

    screen.getByText(/Couldn't load the task form, so its output view/);
    expect(screen.getAllByText("—")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(taskForm.refetch).toHaveBeenCalled();
  });
});
