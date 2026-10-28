import {
  actionSuitesAddSuiteEventAdmin,
  type ActionEventDto,
  type ActionSuiteDto,
  type CreateActionEventDto,
} from "@alliance/shared/client";
import { makeAction, makeProfile } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  expect,
  it,
  mock,
  setSystemTime,
} from "bun:test";
import { MemoryRouter } from "react-router";
import { spellcheckerQuery } from "./spellchecker";
import SuiteLaunchPanel from "./SuiteLaunchPanel";

const adminAction = (params: {
  id: number;
  name: string;
  timeEstimate: number;
  body: string;
  memberIds: number[];
  taskFormId?: number | null;
}) => ({
  ...makeAction({ id: params.id, name: params.name }),
  shortDescription: "Short.",
  body: params.body,
  timeEstimate: params.timeEstimate,
  suite: { id: 3, name: "Spring suite" },
  authors: [makeProfile(1)],
  taskFormId: params.taskFormId === undefined ? 5 : params.taskFormId,
  cohortExpression: { type: "Manual", userIds: params.memberIds },
});

let formPages: { id: string; title: string; fields: [] }[] = [];
let served: Record<number, ReturnType<typeof adminAction>> = {};
let suiteEvents: ActionEventDto[] = [];
const createdEvents: CreateActionEventDto[] = [];
const reminderEventIds: string[] = [];

serveApi(
  routes({
    "GET /actions/all": () => Response.json([]),
    "GET /user/tags": () => Response.json([]),
    "GET /actions/adminslug/:id": ({ params }) =>
      Response.json(served[Number(params.id)]),
    "GET /tasks/adminForm/:id": ({ params }) =>
      Number.isInteger(Number(params.id))
        ? Response.json({
            id: 5,
            title: "Form",
            schema: { pages: formPages, outputViews: [] },
          })
        : Response.json({ statusCode: 400 }, { status: 400 }),
    "POST /actions/evaluate-cohort": async ({ request }) => {
      const { expression }: { expression: { userIds: number[] } } =
        await request.json();
      return Response.json({ userIds: expression.userIds });
    },
    "GET /user/list": () =>
      Response.json([
        { id: 10, name: "Ana", profilePicture: null },
        { id: 11, name: "Ben", profilePicture: null },
      ]),
    "POST /actions/suite/:suiteId/events": async ({ request }) => {
      const body: CreateActionEventDto = await request.json();
      createdEvents.push(body);
      suiteEvents = [
        ...suiteEvents,
        { ...body, id: 100 + suiteEvents.length, suiteManaged: true },
      ];
      return Response.json(suiteWith(suiteEvents));
    },
    "POST /actions/events/:eventId/createremindergroup": ({ params }) => {
      reminderEventIds.push(params.eventId);
      return Response.json({ id: reminderEventIds.length });
    },
  }),
);

const suiteWith = (events: ActionEventDto[]): ActionSuiteDto => ({
  id: 3,
  name: "Spring suite",
  actions: [
    makeAction({ id: 1, name: "Call" }),
    makeAction({ id: 2, name: "Write" }),
  ],
  events,
  reminderGroups: [],
  generalUpdates: [],
});

beforeEach(() => {
  served = {
    1: adminAction({
      id: 1,
      name: "Call",
      timeEstimate: 10,
      body: "Call  your representative.",
      memberIds: [10, 11],
    }),
    2: adminAction({
      id: 2,
      name: "Write",
      timeEstimate: 8,
      body: "Write teh letter.",
      memberIds: [11],
    }),
  };
  formPages = [];
  suiteEvents = [];
  createdEvents.length = 0;
  reminderEventIds.length = 0;
});

afterEach(() => setSystemTime());

const onClose = mock(() => {});

const renderPanel = () => {
  const addEvent = (body: CreateActionEventDto) =>
    actionSuitesAddSuiteEventAdmin({
      path: { suiteId: 3 },
      body,
      throwOnError: true,
    }).then((res) => res.data);
  const query = queryWrapper();
  // The dictionary loads through Vite's `?raw` imports, which bun can't resolve.
  query.client.setQueryData(
    spellcheckerQuery.queryKey,
    () => (word: string) => word !== "teh",
  );
  return render(
    <MemoryRouter>
      <ToastProvider>
        <SuiteLaunchPanel
          suite={suiteWith([])}
          addEvent={addEvent}
          onClose={onClose}
        />
      </ToastProvider>
    </MemoryRouter>,
    query,
  );
};

const launchButton = () =>
  screen.getByRole("button", { name: /Launch and notify/ });

const resolveEveryCheck = async () => {
  for (const box of await screen.findAllByRole("checkbox", {
    name: "I checked this",
  }))
    fireEvent.click(box);
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: "These members are meant to get this much",
    }),
  );
  for (const dismiss of screen.getAllByRole("button", { name: "Dismiss" }))
    fireEvent.click(dismiss);
};

it("flags overloaded members and text findings, and blocks launch until each is resolved", async () => {
  renderPanel();

  expect(await screen.findByText(/Ben/)).toBeTruthy();
  expect(
    screen.getByText(": 18 min (Call, Write)", { exact: false }),
  ).toBeTruthy();
  expect(screen.getByText("Double space · Call · Body")).toBeTruthy();
  expect(screen.getByText("Possible misspelling · Write · Body")).toBeTruthy();
  expect(
    screen.getByText("1 member has more than 15 minutes of actions."),
  ).toBeTruthy();
  expect(launchButton().hasAttribute("disabled")).toBe(true);

  await resolveEveryCheck();

  await waitFor(() =>
    expect(launchButton().hasAttribute("disabled")).toBe(false),
  );
  expect(launchButton().textContent).toContain("Launch and notify 2 members");
});

it("lists each action's unfinished checklist items", async () => {
  served[2] = { ...served[2], body: "", taskFormId: null };
  renderPanel();

  expect(
    await screen.findByText("Missing: Full body content, Task form linked"),
  ).toBeTruthy();
  expect(screen.queryByText(/Failed to load the task form/)).toBeNull();
  await resolveEveryCheck();
  expect(
    screen.getByText("1 action has unfinished checklist items."),
  ).toBeTruthy();
  expect(launchButton().hasAttribute("disabled")).toBe(true);
});

it("creates both events and the default reminders once the count is typed", async () => {
  renderPanel();
  await resolveEveryCheck();
  await waitFor(() =>
    expect(launchButton().hasAttribute("disabled")).toBe(false),
  );

  fireEvent.click(launchButton());
  fireEvent.change(
    await screen.findByPlaceholderText("I am going to notify 2 real members"),
    { target: { value: "I am going to notify 2 real members" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Launch" }));

  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(createdEvents.map((event) => event.newStatus)).toEqual([
    "member_action",
    "office_action",
  ]);
  expect(reminderEventIds).toEqual(Array(7).fill("100"));
});

it("refuses to launch once the member start has passed while the panel sat open", async () => {
  renderPanel();
  await resolveEveryCheck();
  await waitFor(() =>
    expect(launchButton().hasAttribute("disabled")).toBe(false),
  );

  setSystemTime(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));
  fireEvent.click(launchButton());
  fireEvent.change(
    await screen.findByPlaceholderText("I am going to notify 2 real members"),
    { target: { value: "I am going to notify 2 real members" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Launch" }));

  expect(
    await screen.findByText(
      "Members taking action must start in the future. Pick a later time.",
    ),
  ).toBeTruthy();
  expect(createdEvents).toEqual([]);
});

it("links a task form finding to the form and a body finding to the action", async () => {
  formPages = [{ id: "p1", title: "Page  one", fields: [] }];
  renderPanel();

  const formFinding = (
    await screen.findAllByText("Double space · Call · Task form")
  )[0].closest("li");
  const bodyFinding = screen
    .getByText("Double space · Call · Body")
    .closest("li");
  expect(
    formFinding
      ?.querySelector('[aria-label="Edit task form"]')
      ?.getAttribute("href"),
  ).toBe("/forms/5");
  expect(
    bodyFinding
      ?.querySelector('[aria-label="Edit action"]')
      ?.getAttribute("href"),
  ).toBe("/actions/1");
});

it("previews the actions assigned to a picked member", async () => {
  renderPanel();
  await screen.findByText("Double space · Call · Body");

  fireEvent.change(screen.getByPlaceholderText("Search by name"), {
    target: { value: "Ana" },
  });
  fireEvent.click(await screen.findByRole("button", { name: /Ana/ }));

  const row = (
    await screen.findByRole("link", { name: "Log in as this member" })
  ).closest("li");
  expect(row?.textContent).toContain("Ana10 min");
  expect(row?.textContent).toContain("Call");
  expect(row?.textContent).not.toContain("Write");
  expect(
    screen
      .getByRole("link", { name: "Log in as this member" })
      .getAttribute("href"),
  ).toEndWith("/auth/impersonate/10");
});

it("groups members by the actions they get and previews one from a group", async () => {
  renderPanel();
  await screen.findByText("Double space · Call · Body");

  const mixes = screen.getAllByRole("button", {
    name: "Preview a member who gets these actions",
  });
  expect(mixes.map((button) => button.closest("tr")?.textContent)).toEqual([
    "118Call, Write",
    "110Call",
  ]);
  fireEvent.click(mixes[0]);

  const row = (
    await screen.findByRole("link", { name: "Log in as this member" })
  ).closest("li");
  expect(row?.textContent).toContain("Ben18 min");
});

it("lists the reminders the launch creates", async () => {
  renderPanel();
  expect(await screen.findByText("7 created on launch")).toBeTruthy();
  expect(screen.getByText("Member Action announcement")).toBeTruthy();
  expect(screen.getByText("Missed deadline message")).toBeTruthy();
});

it("shows each action's audience, task form link, and what to look at before checking it", async () => {
  served[2] = { ...served[2], image: null, archived: true };
  renderPanel();

  const write = (await screen.findByText(/^1 members ·/)).closest("li");
  expect(write?.textContent).toContain("Archived · No cover image");
  expect(
    write?.querySelector('[aria-label="Edit task form"]')?.getAttribute("href"),
  ).toBe("/forms/5");
  expect(screen.getByText(/^2 members ·/)).toBeTruthy();
});
