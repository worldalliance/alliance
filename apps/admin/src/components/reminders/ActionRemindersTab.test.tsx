import { makeAction, makeEvent } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import ActionRemindersTab from "./ActionRemindersTab";

afterEach(cleanup);

serveApi(
  routes({
    "GET /user/list": () => Response.json({}, { status: 500 }),
    "GET /user/tags": () => Response.json([]),
    "GET /actions/reminderGroupsForEvent/:id": () => Response.json([]),
    "GET /actions/reminderAnchorCandidates/:id": () => Response.json([]),
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
