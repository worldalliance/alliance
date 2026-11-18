import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router";
import { FIRST_TASK_ANCHOR } from "./steps";
import { scrollDelta, Walkthrough } from "./Walkthrough";

function Search() {
  return <p data-testid="search">{useLocation().search}</p>;
}

function Task() {
  return (
    <div
      data-testid="task"
      data-walkthrough={FIRST_TASK_ANCHOR}
      ref={(el) => {
        if (el) {
          el.getBoundingClientRect = () =>
            DOMRect.fromRect({ x: 0, y: 100, width: 400, height: 200 });
        }
      }}
    >
      <button type="button" onClick={(event) => event.stopPropagation()}>
        Begin
      </button>
    </div>
  );
}

function renderAt(path: string, { task = true } = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      {task && <Task />}
      <Walkthrough />
      <Search />
    </MemoryRouter>,
  );
}

it("points a new member at their first task and leaves when they begin it", async () => {
  renderAt("/tasks?walkthrough=1");

  const tour = screen.getByRole("status");
  expect(tour.textContent).toContain("Your first task");
  expect(within(tour).queryAllByRole("button")).toHaveLength(0);
  await waitFor(() => expect(tour.className).not.toContain("invisible"));

  fireEvent.click(screen.getByRole("button", { name: "Begin" }));

  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByTestId("search").textContent).toBe("");
});

it("closes on Escape", () => {
  renderAt("/tasks?walkthrough=1");

  fireEvent.keyDown(window, { key: "Escape" });

  expect(screen.queryByRole("status")).toBeNull();
});

it("ends without showing when there is no task to point at", async () => {
  renderAt("/tasks?walkthrough=1", { task: false });
  const clock = jest.spyOn(Date, "now").mockReturnValue(Date.now() + 60_000);

  await waitFor(() =>
    expect(screen.getByTestId("search").textContent).toBe(""),
  );
  expect(screen.queryByRole("status")).toBeNull();
  clock.mockRestore();
});

it("shows nowhere but the tasks page", () => {
  renderAt("/membership?walkthrough=1");

  expect(screen.queryByRole("status")).toBeNull();
});

const shade = () => document.querySelector("[data-ob-tour] .bg-black\\/60");

it("closes on a click on the dimmed area", async () => {
  renderAt("/tasks?walkthrough=1");
  const tour = screen.getByRole("status");
  await waitFor(() => expect(tour.className).not.toContain("invisible"));

  const dimmed = shade();
  if (!dimmed) throw new Error("no dimmed area");
  fireEvent.click(dimmed);

  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByTestId("search").textContent).toBe("");
});

function LeaveAndReturn() {
  const navigate = useNavigate();
  const [task, setTask] = useState(true);
  return (
    <>
      {task && <Task />}
      <button
        type="button"
        onClick={() => {
          setTask(false);
          navigate("/membership");
        }}
      >
        Leave
      </button>
      <button type="button" onClick={() => navigate("/tasks?walkthrough=1")}>
        Return
      </button>
    </>
  );
}

function RemovableTask() {
  const [task, setTask] = useState(true);
  return (
    <>
      {task && <Task />}
      <button type="button" onClick={() => setTask(false)}>
        Remove
      </button>
    </>
  );
}

it("ends once the task it pointed at is gone", async () => {
  render(
    <MemoryRouter initialEntries={["/tasks?walkthrough=1"]}>
      <RemovableTask />
      <Walkthrough />
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(screen.getByRole("status").className).not.toContain("invisible"),
  );

  fireEvent.click(screen.getByRole("button", { name: "Remove" }));

  await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  expect(shade()).toBeNull();
});

it("shows nothing on a later tour until its task turns up", async () => {
  render(
    <MemoryRouter initialEntries={["/tasks?walkthrough=1"]}>
      <LeaveAndReturn />
      <Walkthrough />
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(screen.getByRole("status").className).not.toContain("invisible"),
  );

  fireEvent.click(screen.getByRole("button", { name: "Leave" }));
  fireEvent.click(screen.getByRole("button", { name: "Return" }));

  expect(screen.getByRole("status").className).toContain("invisible");
  expect(shade()).toBeNull();
});

it("scrolls a task too tall for the space above the box so its Begin shows", () => {
  const task = { top: 100, left: 0, width: 400, height: 600 };

  expect(scrollDelta(task, 500, 60)).toBe(100 + 600 - (500 - 16));
});
