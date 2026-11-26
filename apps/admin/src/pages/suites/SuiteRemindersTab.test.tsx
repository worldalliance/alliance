import type {
  ActionSuiteDto,
  PreviewEmailHtmlDto,
  PreviewTextDto,
  ReminderAnchorCandidateDto,
} from "@alliance/shared/client/types.gen";
import { makeAction, makeEvent } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import LeaveGuard from "../../components/LeaveGuard";
import { ToastProvider } from "../../ui/ToastProvider";
import { SuiteRemindersTab } from "./SuiteRemindersTab";

let groups: ({ id: number; name: string } & Record<string, unknown>)[] = [];
let groupsStatus = 200;
let groupsByEvent: Record<string, typeof groups> | null = null;
let deleteStatus = 200;
let createStatus = 200;
let updateRequests = 0;
let anchorCandidatesStatus = 200;
let anchorCandidates: ReminderAnchorCandidateDto[] = [];
const previewRequests: unknown[] = [];

serveApi(
  routes({
    "GET /user/list": () => Response.json({}, { status: 500 }),
    "GET /user/tags": () => Response.json([]),
    "GET /actions/reminderGroupsForEvent/:id": ({ params }) =>
      Response.json(groupsByEvent?.[params.id] ?? groups, {
        status: groupsStatus,
      }),
    "GET /actions/reminderAnchorCandidates/:id": () =>
      Response.json(anchorCandidates, { status: anchorCandidatesStatus }),
    "GET /actions/plansForGroup/:groupId": () => Response.json([]),
    "GET /actions/sentNotifsForGroup/:groupId": () => Response.json([]),
    "POST /actions/events/:eventId/createremindergroup": async ({
      request,
    }) => {
      if (createStatus !== 200)
        return Response.json(
          { message: "Reminder name taken" },
          { status: createStatus },
        );
      const { name }: { name: string } = await request.json();
      const created = {
        id: groups.length + 1,
        name,
        timingMode: "event_launch",
      };
      groups = [...groups, created];
      return Response.json(created);
    },
    "POST /actions/events/:eventId/checkTentativePlans": () =>
      Response.json([]),
    "POST /actions/previewEmailHtml/:eventId": async ({ request, params }) => {
      const body: PreviewEmailHtmlDto = await request.json();
      previewRequests.push({ ...params, ...body });
      return Response.json({
        subject: `Rendered ${body.emailSubject}`,
        html: `Rendered ${body.emailMessage}`,
      });
    },
    "POST /actions/previewTextMessage/:eventId": async ({
      request,
      params,
    }) => {
      const body: PreviewTextDto = await request.json();
      previewRequests.push({ ...params, ...body });
      return Response.json({ text: `Rendered ${body.textMessage}` });
    },
    "PATCH /actions/remindergroups/:groupId": () => {
      updateRequests += 1;
      return Response.json({ message: "Reminder name taken" }, { status: 400 });
    },
    "DELETE /actions/reminders/:groupId": ({ params }) => {
      if (deleteStatus !== 200)
        return Response.json({}, { status: deleteStatus });
      groups = groups.filter((group) => String(group.id) !== params.groupId);
      return new Response(null, { status: 200 });
    },
  }),
);

afterEach(() => {
  groups = [];
  groupsByEvent = null;
  groupsStatus = 200;
  deleteStatus = 200;
  createStatus = 200;
  anchorCandidatesStatus = 200;
  anchorCandidates = [];
  previewRequests.length = 0;
});

const renderSuite = (
  actions: ActionSuiteDto["actions"],
  highlightedReminder: number | null = null,
) => {
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
                highlightedReminder={highlightedReminder}
              />
            </ToastProvider>
          </LeaveGuard>
        ),
      },
    ],
    { initialEntries: ["/tasks/suites/1?tab=reminders"] },
  );
  return render(<RouterProvider router={router} />, queryWrapper());
};

const renderTab = (events = [makeEvent({ newStatus: "member_action" })]) =>
  renderSuite([makeAction({ events })]);

it("lists the groups of every task's members taking action event", async () => {
  groupsByEvent = {
    "1": [{ id: 1, name: "On the first task", timingMode: "event_launch" }],
    "2": [{ id: 2, name: "On the second task", timingMode: "event_launch" }],
  };
  renderSuite([
    makeAction({
      id: 1,
      events: [makeEvent({ id: 1, newStatus: "member_action" })],
    }),
    makeAction({
      id: 2,
      events: [makeEvent({ id: 2, newStatus: "member_action" })],
    }),
  ]);

  expect(await screen.findByText("On the first task")).toBeTruthy();
  expect(screen.getByText("On the second task")).toBeTruthy();
});

it("says a suite without a members taking action event gets reminders at launch", () => {
  renderTab([]);

  expect(
    screen.getByText(
      /Launching the suite creates that event and the default reminders/,
    ),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "New reminder" })).toBeNull();
});

it("marks the reminder the timeline asked for, then lets it go", async () => {
  groups = [
    { id: 1, name: "Announcement", timingMode: "event_launch" },
    { id: 2, name: "Last call", timingMode: "event_launch" },
  ];
  renderSuite(
    [makeAction({ events: [makeEvent({ newStatus: "member_action" })] })],
    2,
  );

  const row = (await screen.findByText("Last call")).closest("tr");
  expect(row?.getAttribute("aria-selected")).toBe("true");
  expect(
    screen
      .getByText("Announcement")
      .closest("tr")
      ?.getAttribute("aria-selected"),
  ).toBeNull();
  await waitFor(() => expect(row?.getAttribute("aria-selected")).toBeNull(), {
    timeout: 3000,
  });
});

it("says under the custom recipients picker when the user list fails to load", async () => {
  renderTab();

  fireEvent.click(await screen.findByRole("button", { name: "New reminder" }));
  fireEvent.change(screen.getByDisplayValue("All uncompleted"), {
    target: { value: "custom" },
  });

  expect(await screen.findByText("Failed to load users.")).toBeTruthy();
});

it("says the reminders failed to load", async () => {
  groupsStatus = 500;
  renderTab();

  expect(await screen.findByText("Couldn't load reminders")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Populate default reminders" }),
  ).toBeNull();
});

it("says the dependency deadlines failed to load", async () => {
  anchorCandidatesStatus = 500;
  renderTab();

  expect(
    await screen.findByText(/Couldn't load the dependency deadlines/),
  ).toBeTruthy();
});

it("schedules a from-deadline group from the event after the member-action event", async () => {
  const memberAction = makeEvent({ id: 1, newStatus: "member_action" });
  groups = [
    {
      id: 1,
      name: "Last call",
      timingMode: "from_deadline",
      sendAtSecondsFromDeadline: 0,
      memberActionEvent: memberAction,
    },
  ];
  renderTab([
    memberAction,
    makeEvent({
      id: 2,
      newStatus: "office_action",
      title: "Same instant",
      date: memberAction.date,
    }),
    makeEvent({
      id: 3,
      newStatus: "resolution",
      title: "Close",
      date: new Date(Date.now() + 1000).toISOString(),
    }),
  ]);

  fireEvent.click(
    await screen.findByRole("button", { name: "Details: Last call" }),
  );

  expect(await screen.findByText("Sends when Close begins")).toBeTruthy();
});

const deleteGroup = async (name: string) => {
  fireEvent.click(
    await screen.findByRole("button", { name: `Delete: ${name}` }),
  );
  fireEvent.click(await screen.findByRole("button", { name: "Delete group" }));
};

it("removes a deleted group", async () => {
  groups = [
    { id: 1, name: "Announcement", timingMode: "event_launch" },
    { id: 2, name: "Last call", timingMode: "event_launch" },
  ];
  renderTab();

  await deleteGroup("Last call");

  await waitFor(() => expect(screen.queryByText("Last call")).toBeNull());
  expect(screen.getByText("Announcement")).toBeTruthy();
});

it("says a delete was refused and keeps the group", async () => {
  groups = [{ id: 1, name: "Announcement", timingMode: "event_launch" }];
  deleteStatus = 403;
  renderTab();

  await deleteGroup("Announcement");

  expect(
    await screen.findByText("Couldn't delete the reminder group."),
  ).toBeTruthy();
  expect(screen.getByText("Announcement")).toBeTruthy();
});

const eventsWithDeadline = () => [
  makeEvent({ id: 1, newStatus: "member_action" }),
  makeEvent({
    id: 2,
    newStatus: "completed",
    date: new Date(Date.now() + 1000).toISOString(),
  }),
];

const populate = async () => {
  fireEvent.click(
    await screen.findByRole("button", { name: "Populate default reminders" }),
  );
  fireEvent.change(
    await screen.findByPlaceholderText(
      "I am going to notify many real members",
    ),
    { target: { value: "I am going to notify many real members" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
};

it("populates the default reminders in order", async () => {
  renderTab(eventsWithDeadline());

  await populate();

  expect(await screen.findByText("Reminders created")).toBeTruthy();
  expect(groups.map((group) => group.name)).toEqual([
    "Member action announcement",
    "24-48h reminder",
    "6-24h reminder",
    "3 hour reminder",
    "Missed deadline message",
    "Group leads 3 days reminder",
    "Group leads 2 days reminder",
  ]);
});

it("populates only the announcement without a deadline event", async () => {
  renderTab();

  await populate();

  expect(
    await screen.findByText(/^Created only the announcement/),
  ).toBeTruthy();
  expect(groups.map((group) => group.name)).toEqual([
    "Member action announcement",
  ]);
});

it("says why a populate was refused", async () => {
  createStatus = 400;
  renderTab();

  await populate();

  expect(await screen.findByText("Reminder name taken")).toBeTruthy();
  expect(screen.queryByText(/^Created only the announcement/)).toBeNull();
});

it("clears a refused populate's message when a retry succeeds", async () => {
  createStatus = 400;
  renderTab(eventsWithDeadline());
  await populate();
  await screen.findByText("Reminder name taken");

  createStatus = 200;
  await populate();

  expect(await screen.findByText("Reminders created")).toBeTruthy();
  expect(screen.queryByText("Reminder name taken")).toBeNull();
});

const announcementGroup = {
  id: 1,
  name: "Announcement",
  timingMode: "event_launch",
  cohortType: "all_uncompleted",
  emailSubject: "Subject",
  emailMessage: "Body",
  textMessage: "Text",
  pushMessage: "Push",
  memberActionEvent: { id: 1 },
};

it("says why an edit was refused and keeps the form open", async () => {
  groups = [announcementGroup];
  renderTab();

  fireEvent.click(
    await screen.findByRole("button", { name: "Edit: Announcement" }),
  );
  const submit = await screen.findByRole("button", {
    name: "Save changes",
  });
  await waitFor(() => expect(submit).toHaveProperty("disabled", false));
  fireEvent.click(submit);

  expect(await screen.findByText(/Reminder name taken/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Save changes" })).toBeTruthy();
});

it.each([
  ["Save anyway", 1],
  ["Cancel", 0],
])(
  "sends a reminder that mentions worldalliance on %s %i times",
  async (choice, saves) => {
    groups = [
      { ...announcementGroup, textMessage: "See https://worldalliance.org/x" },
    ];
    updateRequests = 0;
    renderTab();

    fireEvent.click(
      await screen.findByRole("button", { name: "Edit: Announcement" }),
    );
    const submit = await screen.findByRole("button", {
      name: "Save changes",
    });
    await waitFor(() => expect(submit).toHaveProperty("disabled", false));
    fireEvent.click(submit);

    expect(
      (await screen.findByRole("dialog", { name: "Save anyway?" })).textContent,
    ).toContain("See https://worldalliance.org/x");
    expect(updateRequests).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: choice }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Save anyway?" })).toBeNull(),
    );
    await waitFor(() => expect(updateRequests).toBe(saves));
    expect(
      await screen.findByRole("button", { name: "Save changes" }),
    ).toBeTruthy();
  },
);

const openPresets = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "New reminder" }));
  fireEvent.click(await screen.findByRole("button", { name: "Load preset" }));
};

const createFromAnnouncementPreset = async () => {
  await openPresets();
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Announcement" }),
  );
  await screen.findByText(/^This sends/);
  fireEvent.click(screen.getByRole("button", { name: "Create reminders" }));
  fireEvent.change(
    await screen.findByPlaceholderText("I am going to notify 0 real members"),
    { target: { value: "I am going to notify 0 real members" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
};

const anchorCandidate = (deadlineEventId: number, offsetMs: number) => ({
  actionId: deadlineEventId,
  actionName: `Dependency ${deadlineEventId}`,
  deadlineEventId,
  deadlineEventDate: new Date(Date.now() + offsetMs).toISOString(),
});

it("anchors a dependency-deadline preset to the next upcoming deadline", async () => {
  anchorCandidates = [
    anchorCandidate(10, -60_000),
    anchorCandidate(11, 60_000),
    anchorCandidate(12, 120_000),
  ];
  renderTab();
  await openPresets();

  await waitFor(() =>
    expect(
      screen
        .getByRole("menuitem", { name: "Catch-up late joiners" })
        .getAttribute("aria-disabled"),
    ).not.toBe("true"),
  );
  fireEvent.click(
    screen.getByRole("menuitem", { name: "Catch-up late joiners" }),
  );

  expect(
    await screen.findByDisplayValue(
      "Catch-up announcement for late cohort joiners",
    ),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("option", { name: "This task's deadline" })
      .closest("select"),
  ).toHaveProperty("value", "11");
  expect(screen.queryByRole("menuitem", { name: "Announcement" })).toBeNull();
});

it("disables a dependency-deadline preset without an upcoming deadline", async () => {
  anchorCandidates = [anchorCandidate(10, -60_000)];
  renderTab();
  await openPresets();
  // The preset is also disabled before the candidates load, so wait for them.
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Two day range" }),
  );
  await screen.findByRole("option", { name: /^Dependency 10 deadline/ });
  fireEvent.click(screen.getByRole("button", { name: "Load preset" }));

  const preset = await screen.findByRole("menuitem", {
    name: "Catch-up late joiners",
  });

  expect(preset.getAttribute("aria-disabled")).toBe("true");
  expect(preset.getAttribute("title")).toBe(
    "Needs an upcoming dependency deadline to anchor to; this task's cohort has none",
  );
  expect(
    screen
      .getByRole("menuitem", { name: "Announcement" })
      .getAttribute("aria-disabled"),
  ).not.toBe("true");
});

it("creates a group from the form and closes it", async () => {
  renderTab();

  await createFromAnnouncementPreset();

  expect(await screen.findByText("Reminder group created")).toBeTruthy();
  expect(
    await screen.findByRole("button", {
      name: "Edit: Member action announcement",
    }),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Create reminders" })).toBeNull();
});

it("says why a create from the form was refused and keeps it open", async () => {
  createStatus = 400;
  renderTab();

  await createFromAnnouncementPreset();

  expect(await screen.findAllByText(/Reminder name taken/)).not.toHaveLength(0);
  expect(screen.getByRole("button", { name: "Create reminders" })).toBeTruthy();
});

it("previews an expanded reminder's messages", async () => {
  groups = [announcementGroup];
  renderTab();
  const expand = await screen.findByRole("button", {
    name: "Details: Announcement",
  });
  expect(previewRequests).toEqual([]);

  fireEvent.click(expand);

  expect(await screen.findByText("Rendered Subject")).toBeTruthy();
  expect(screen.getByText("Rendered Body")).toBeTruthy();
  expect(await screen.findByText("Rendered Text")).toBeTruthy();
  expect(await screen.findByText("Rendered Push")).toBeTruthy();
  const preview = { eventId: "1", taskCount: 1, cohortType: "all_uncompleted" };
  expect(previewRequests).toEqual(
    expect.arrayContaining([
      { ...preview, emailSubject: "Subject", emailMessage: "Body" },
      { ...preview, textMessage: "Text" },
      { ...preview, textMessage: "Push" },
    ]),
  );
});

it("does not preview a reminder being edited", async () => {
  groups = [announcementGroup];
  renderTab();

  fireEvent.click(
    await screen.findByRole("button", { name: "Edit: Announcement" }),
  );
  await screen.findByRole("button", { name: "Save changes" });
  await new Promise((resolve) => setTimeout(resolve, 50));

  expect(previewRequests).toEqual([]);
});
