import type {
  PreviewEmailHtmlDto,
  PreviewTextDto,
  ReminderAnchorCandidateDto,
} from "@alliance/shared/client/types.gen";
import { makeAction, makeEvent } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import ActionRemindersTab from "./ActionRemindersTab";

let groups: ({ id: number; name: string } & Record<string, unknown>)[] = [];
let groupsStatus = 200;
let deleteStatus = 200;
let createStatus = 200;
let anchorCandidatesStatus = 200;
let anchorCandidates: ReminderAnchorCandidateDto[] = [];
const previewRequests: unknown[] = [];

serveApi(
  routes({
    "GET /user/list": () => Response.json({}, { status: 500 }),
    "GET /user/tags": () => Response.json([]),
    "GET /actions/reminderGroupsForEvent/:id": () =>
      Response.json(groups, { status: groupsStatus }),
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
    "PATCH /actions/remindergroups/:groupId": () =>
      Response.json({ message: "Reminder name taken" }, { status: 400 }),
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
  groupsStatus = 200;
  deleteStatus = 200;
  createStatus = 200;
  anchorCandidatesStatus = 200;
  anchorCandidates = [];
  previewRequests.length = 0;
});

const renderTab = (events = [makeEvent({ newStatus: "member_action" })]) =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <ActionRemindersTab
          suite={{
            id: 1,
            name: "Suite",
            actions: [makeAction({ events })],
            events: [],
            reminderGroups: [],
            generalUpdates: [],
          }}
        />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

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

  expect(await screen.findByText("Failed to load reminders.")).toBeTruthy();
  expect(
    screen.queryByRole("button", { name: "Populate default reminders" }),
  ).toBeNull();
});

it("says the dependency deadlines failed to load", async () => {
  anchorCandidatesStatus = 500;
  renderTab();

  expect(
    await screen.findByText(
      "Failed to load dependency deadlines for timing anchors.",
    ),
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

  expect(await screen.findByText("Sends when Close begins")).toBeTruthy();
});

const deleteGroup = async (name: string) => {
  const card = (await screen.findByText(name)).closest(".bg-white");
  if (!(card instanceof HTMLElement)) throw new Error(`no card for ${name}`);
  fireEvent.click(within(card).getByRole("button", { name: "Delete" }));
  const confirmButtons = await screen.findAllByRole("button", {
    name: "Delete",
  });
  fireEvent.click(confirmButtons[confirmButtons.length - 1]);
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
    await screen.findByText("Failed to delete reminder group."),
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

  expect(
    await screen.findByText("Reminders created successfully."),
  ).toBeTruthy();
  expect(groups.map((group) => group.name)).toEqual([
    "Member Action announcement",
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
    await screen.findByText(
      "No deadline reminders created - does this event have a deadline?",
    ),
  ).toBeTruthy();
  expect(groups.map((group) => group.name)).toEqual([
    "Member Action announcement",
  ]);
});

it("says why a populate was refused", async () => {
  createStatus = 400;
  renderTab();

  await populate();

  expect(await screen.findByText("Reminder name taken")).toBeTruthy();
  expect(
    screen.queryByText(
      "No deadline reminders created - does this event have a deadline?",
    ),
  ).toBeNull();
});

it("clears a refused populate's message when a retry succeeds", async () => {
  createStatus = 400;
  renderTab(eventsWithDeadline());
  await populate();
  await screen.findByText("Reminder name taken");

  createStatus = 200;
  await populate();

  expect(
    await screen.findByText("Reminders created successfully."),
  ).toBeTruthy();
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

  fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
  const submit = await screen.findByRole("button", {
    name: "Update Reminders",
  });
  await waitFor(() => expect(submit).toHaveProperty("disabled", false));
  fireEvent.click(submit);

  expect(await screen.findByText("Reminder name taken")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Update Reminders" })).toBeTruthy();
});

const openPresets = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "New reminder" }));
  fireEvent.click(screen.getByRole("button", { name: "Load preset..." }));
};

const createFromAnnouncementPreset = async () => {
  await openPresets();
  fireEvent.click(screen.getByRole("button", { name: "Announcement" }));
  const submit = screen.getByRole("button", { name: "Create Reminders" });
  await waitFor(() => expect(submit).toHaveProperty("disabled", false));
  fireEvent.click(submit);
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

  const preset = await screen.findByRole("button", {
    name: "Catch-up late joiners",
  });
  await waitFor(() => expect(preset).toHaveProperty("disabled", false));
  fireEvent.click(preset);

  expect(
    await screen.findByDisplayValue(
      "Catch-up announcement for late cohort joiners",
    ),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("option", { name: "This action's deadline" })
      .closest("select"),
  ).toHaveProperty("value", "11");
  expect(screen.queryByRole("button", { name: "Announcement" })).toBeNull();
});

it("disables a dependency-deadline preset without an upcoming deadline", async () => {
  anchorCandidates = [anchorCandidate(10, -60_000)];
  renderTab();
  await openPresets();
  // The preset is also disabled before the candidates load, so wait for them.
  fireEvent.click(screen.getByRole("button", { name: "Two Day Range" }));
  await screen.findByRole("option", { name: /^Dependency 10 deadline/ });
  fireEvent.click(screen.getByRole("button", { name: "Load preset..." }));

  const preset = screen.getByRole("button", { name: "Catch-up late joiners" });

  expect(preset).toHaveProperty("disabled", true);
  expect(preset.getAttribute("title")).toBe(
    "Needs an upcoming dependency deadline to anchor to; this action's cohort has none",
  );
  expect(screen.getByRole("button", { name: "Announcement" })).toHaveProperty(
    "disabled",
    false,
  );
});

it("creates a group from the form and closes it", async () => {
  renderTab();

  await createFromAnnouncementPreset();

  expect(
    await screen.findByText("Personal reminders group scheduled successfully."),
  ).toBeTruthy();
  expect(screen.getByText("Member Action announcement")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Create Reminders" })).toBeNull();
});

it("says why a create from the form was refused and keeps it open", async () => {
  createStatus = 400;
  renderTab();

  await createFromAnnouncementPreset();

  expect(await screen.findAllByText("Reminder name taken")).not.toHaveLength(0);
  expect(screen.getByRole("button", { name: "Create Reminders" })).toBeTruthy();
});

it("previews an expanded reminder's messages", async () => {
  groups = [announcementGroup];
  renderTab();
  const expand = await screen.findByRole("button", {
    name: "Expand reminder",
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

  fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
  await screen.findByRole("button", { name: "Update Reminders" });
  await new Promise((resolve) => setTimeout(resolve, 50));

  expect(previewRequests).toEqual([]);
});
