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
