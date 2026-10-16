import { makeEvent } from "@alliance/shared/lib/testFixtures";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { cleanup, render, screen } from "@testing-library/react";
import { adminActionListItem } from "../lib/testing/adminActionListItem";
import EventManagementTab from "./EventManagementTab";

afterEach(cleanup);

it("labels an event's status pill with spaces between words", () => {
  render(
    <ToastProvider>
      <EventManagementTab
        action={adminActionListItem(1, "Action", {
          events: [makeEvent({ newStatus: "office_action" })],
        })}
        setAction={() => {}}
      />
    </ToastProvider>,
  );

  expect(screen.getByText("Office Action", { selector: "span" })).toBeTruthy();
});

it("lists events newest first without reordering the action's events", () => {
  const events = [
    makeEvent({ id: 1, title: "Older", date: "2026-01-01T00:00:00.000Z" }),
    makeEvent({ id: 2, title: "Newer", date: "2026-02-01T00:00:00.000Z" }),
  ];
  render(
    <ToastProvider>
      <EventManagementTab
        action={adminActionListItem(1, "Action", { events })}
        setAction={() => {}}
      />
    </ToastProvider>,
  );

  expect(
    screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent),
  ).toEqual(["Newer", "Older"]);
  expect(events.map((event) => event.id)).toEqual([1, 2]);
});
