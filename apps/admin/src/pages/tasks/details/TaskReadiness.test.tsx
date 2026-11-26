import { fireEvent, render, screen, within } from "@testing-library/react";
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
  it("lists each unfinished item with whether staff testing needs it, then the finished ones in a line", () => {
    render(
      <TaskReadiness
        task={makeParsedAction({
          shortDescription: "Short",
          body: "",
          timeEstimate: 5,
        })}
        taskForm={taskFormQuery({ isLoadingError: false })}
      />,
    );

    const open = within(screen.getByRole("list", { name: "Not ready" }));
    expect(open.getByText(/^Full body content/).textContent).toBe(
      "Full body content · Required for staff testing",
    );
    expect(open.queryByText(/^Short description/)).toBeNull();
    expect(open.getByText(/^Task form has an output view/)).toBeTruthy();
    expect(
      screen.getByText(/Short description · Time estimate set/),
    ).toBeTruthy();
    expect(
      screen.getByRole("region", { name: "Readiness" }).textContent,
    ).toMatch(/(?<!\d)3 of 11 ready/);
  });

  it("marks the task form's items as loading, not unfinished, until the form loads", () => {
    render(
      <TaskReadiness
        task={makeParsedAction({ taskFormId: 3 })}
        taskForm={taskFormQuery({ isLoadingError: false })}
      />,
    );

    const open = within(screen.getByRole("list", { name: "Not ready" }));
    expect(open.queryByText(/^Task form has an output view/)).toBeNull();
    expect(open.queryByText(/^Total reading time/)).toBeNull();
    const unchecked = screen.getByRole("list", { name: "Not checked" });
    expect(within(unchecked).getAllByText("Loading…")).toHaveLength(2);
    expect(within(unchecked).getByText("Total reading time: —")).toBeTruthy();
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
    expect(
      within(screen.getByRole("list", { name: "Not checked" })).getAllByText(
        "—",
      ),
    ).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(taskForm.refetch).toHaveBeenCalled();
  });
});
