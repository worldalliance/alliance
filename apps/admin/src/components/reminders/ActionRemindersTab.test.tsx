import { makeAction, makeEvent } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import ActionRemindersTab from "./ActionRemindersTab";
import { reminderPresets } from "./presets";

const createdBodies: object[] = [];

afterEach(() => {
  cleanup();
  createdBodies.length = 0;
});

serveApi(
  routes({
    "GET /user/list": () => Response.json({}, { status: 500 }),
    "GET /user/tags": () => Response.json([]),
    "GET /actions/reminderGroupsForEvent/:id": () => Response.json([]),
    "GET /actions/reminderAnchorCandidates/:id": () => Response.json([]),
    "POST /actions/events/:eventId/createremindergroup": async ({
      request,
    }) => {
      const body: object = await request.json();
      createdBodies.push(body);
      return Response.json(
        { id: createdBodies.length, ...body },
        { status: 201 },
      );
    },
    "GET /actions/sentNotifsForGroup/:groupId": () => Response.json([]),
    "GET /actions/plansForGroup/:groupId": () => Response.json([]),
  }),
);

it("says under the custom recipients picker when the user list fails to load", async () => {
  render(
    <MemoryRouter>
      <ToastProvider>
        <ActionRemindersTab
          suite={{
            id: 1,
            name: "Suite",
            actions: [
              makeAction({
                events: [makeEvent({ newStatus: "member_action" })],
              }),
            ],
            events: [],
            reminderGroups: [],
            generalUpdates: [],
          }}
        />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

  fireEvent.click(await screen.findByRole("button", { name: "New reminder" }));
  fireEvent.change(screen.getByDisplayValue("All uncompleted"), {
    target: { value: "custom" },
  });

  expect(await screen.findByText("Failed to load users.")).toBeTruthy();
});

it("populates the 24-48h slot with the streak recognition preset", async () => {
  render(
    <MemoryRouter>
      <ToastProvider>
        <ActionRemindersTab
          suite={{
            id: 1,
            name: "Suite",
            actions: [
              makeAction({
                events: [
                  makeEvent({ id: 1, newStatus: "member_action" }),
                  makeEvent({
                    id: 2,
                    newStatus: "office_action",
                    date: new Date(Date.now() + 7 * 86_400_000).toISOString(),
                  }),
                ],
              }),
            ],
            events: [],
            reminderGroups: [],
            generalUpdates: [],
          }}
        />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

  fireEvent.click(
    await screen.findByRole("button", { name: "Populate default reminders" }),
  );
  const requiredText = "I am going to notify many real members";
  fireEvent.change(await screen.findByPlaceholderText(requiredText), {
    target: { value: requiredText },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));

  await waitFor(() => expect(createdBodies).toHaveLength(7));
  expect(createdBodies[1]).toEqual({
    suiteId: 1,
    ...reminderPresets["Streak recognition"],
  });
});
