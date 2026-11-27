import type { ActionSuite } from "@alliance/shared/client";
import { makeEvent } from "@alliance/shared/lib/testFixtures";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, jest } from "bun:test";
import { MemoryRouter } from "react-router";
import { adminActionListItem } from "../../../lib/testing/adminActionListItem";
import { ToastProvider } from "../../../ui/ToastProvider";
import { EventsTab } from "./EventsTab";

afterEach(cleanup);

const renderTab = (
  overrides: Parameters<typeof adminActionListItem>[2] = {},
  suite?: ActionSuite,
) =>
  render(
    <ToastProvider>
      <MemoryRouter>
        <EventsTab
          task={{ ...adminActionListItem(1, "Task", overrides), suite }}
          admin={{ addEvent: jest.fn() }}
        />
      </MemoryRouter>
    </ToastProvider>,
  );

it("labels an event's status with its phase's words", () => {
  renderTab({ events: [makeEvent({ newStatus: "office_action" })] });

  expect(screen.getByText("Office taking action")).toBeTruthy();
});

it("lists events newest first without reordering the action's events", () => {
  const events = [
    makeEvent({ id: 1, title: "Older", date: "2026-01-01T00:00:00.000Z" }),
    makeEvent({ id: 2, title: "Newer", date: "2026-02-01T00:00:00.000Z" }),
  ];
  renderTab({ events });

  const rows = screen.getAllByRole("row").slice(1);
  expect(
    rows.map((row) => within(row).getAllByRole("cell")[0].textContent),
  ).toEqual(["Newer", "Older"]);
  expect(events.map((event) => event.id)).toEqual([1, 2]);
});

it("offers no edit or delete for a task's own events", () => {
  renderTab({ events: [makeEvent()] });

  expect(screen.queryByRole("button", { name: /edit|delete/i })).toBeNull();
});

it("keeps the add form closed until staff ask for it", () => {
  renderTab();

  expect(screen.queryByLabelText("Status this event sets")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Add event" }));
  expect(screen.getByLabelText("Status this event sets")).toBeTruthy();
});

it("sends a task in a suite to the suite's Launch tab and events first", () => {
  renderTab(
    {},
    {
      id: 7,
      name: "Week 12",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      events: [],
    },
  );

  expect(
    screen.getByRole("link", { name: "Launch tab" }).getAttribute("href"),
  ).toBe("/tasks/suites/7?tab=launch");
  expect(
    screen.getByText(/An event added here changes this task only/),
  ).toBeTruthy();
});

it("says who sees a task with no events", () => {
  renderTab();

  expect(screen.getByText("No events yet")).toBeTruthy();
  expect(
    screen.getByText(/As a draft it is seen by: admins only/),
  ).toBeTruthy();
});
