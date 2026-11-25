import type { ActionSuiteDto } from "@alliance/shared/client/types.gen";
import { makeAction, makeEvent } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import LeaveGuard from "../../components/LeaveGuard";
import { ToastProvider } from "../../ui/ToastProvider";
import { SuiteRemindersTab } from "./SuiteRemindersTab";

const createdOnEvents: string[] = [];

serveApi(
  routes({
    "GET /user/list": () => Response.json({}, { status: 500 }),
    "GET /user/tags": () => Response.json([]),
    "GET /actions/reminderGroupsForEvent/:id": () => Response.json([]),
    "GET /actions/reminderAnchorCandidates/:id": () => Response.json([]),
    "POST /actions/events/:eventId/createremindergroup": async ({
      request,
      params,
    }) => {
      createdOnEvents.push(params.eventId);
      const { name }: { name: string } = await request.json();
      return Response.json({ id: 1, name, timingMode: "event_launch" });
    },
    "POST /actions/events/:eventId/checkTentativePlans": () =>
      Response.json([]),
    "POST /actions/previewEmailHtml/:eventId": () =>
      Response.json({ subject: "", html: "" }),
    "POST /actions/previewTextMessage/:eventId": () =>
      Response.json({ text: "" }),
  }),
);

afterEach(() => {
  createdOnEvents.length = 0;
});

const renderSuite = (actions: ActionSuiteDto["actions"]) => {
  const router = createMemoryRouter(
    [
      {
        path: "/tasks/suites/:suiteId",
        element: (
          <LeaveGuard>
            <ToastProvider>
              <SuiteRemindersTab
                suite={{
                  id: 1,
                  name: "Suite",
                  actions,
                  events: [],
                  reminderGroups: [],
                  generalUpdates: [],
                  isPartitioned: false,
                }}
                highlightedReminder={null}
              />
            </ToastProvider>
          </LeaveGuard>
        ),
      },
    ],
    { initialEntries: ["/tasks/suites/1?tab=reminders"] },
  );
  render(<RouterProvider router={router} />, queryWrapper());
  return router;
};

it("closes a sheet opened from the tab back to the tab's own entry", async () => {
  const router = renderSuite([
    makeAction({ events: [makeEvent({ newStatus: "member_action" })] }),
  ]);
  fireEvent.click(await screen.findByRole("button", { name: "New reminder" }));
  await screen.findByRole("dialog");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(router.state.historyAction).toBe("POP");
  expect(router.state.location.search).toBe("?tab=reminders");
});

it("keeps the event picked before a preset loads", async () => {
  renderSuite([
    makeAction({
      id: 1,
      name: "Same",
      events: [makeEvent({ id: 1, newStatus: "member_action" })],
    }),
    makeAction({
      id: 2,
      name: "Same",
      events: [makeEvent({ id: 2, newStatus: "member_action" })],
    }),
  ]);
  fireEvent.click(await screen.findByRole("button", { name: "New reminder" }));
  const select = await screen.findByRole("combobox", {
    name: "Members taking action event",
  });
  const other = screen.getByRole("option", { name: /^Same \(#2\)/ });
  fireEvent.change(select, { target: { value: other.getAttribute("value") } });
  fireEvent.click(screen.getByRole("button", { name: "Load preset" }));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Announcement" }),
  );
  await screen.findByDisplayValue("Member action announcement");

  expect(
    screen.getByRole("combobox", { name: "Members taking action event" }),
  ).toHaveProperty("value", "2");
  await screen.findByText(/^This sends/);
  fireEvent.click(screen.getByRole("button", { name: "Create reminders" }));
  fireEvent.change(
    await screen.findByPlaceholderText("I am going to notify 0 real members"),
    { target: { value: "I am going to notify 0 real members" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
  await waitFor(() => expect(createdOnEvents).toEqual(["2"]));
});
