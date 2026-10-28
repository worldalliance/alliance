import {
  actionSuitesAddSuiteEventAdmin,
  type ActionEventDto,
  type ActionSuiteDto,
  type CreateActionEventDto,
  type ProjectDto,
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
  memberIds: number[] | null;
  taskFormId?: number | null;
  image?: string | null;
  project?: ProjectDto | null;
}) => ({
  ...makeAction({ id: params.id, name: params.name }),
  image: params.image === undefined ? "cover.png" : params.image,
  shortDescription: "Short.",
  body: params.body,
  timeEstimate: params.timeEstimate,
  suite: { id: 3, name: "Spring suite" },
  project:
    params.project === undefined
      ? { id: 4, name: "Food drive", category: [] }
      : params.project,
  authors: [makeProfile(1)],
  taskFormId: params.taskFormId === undefined ? 5 : params.taskFormId,
  cohortExpression: params.memberIds && {
    type: "Manual",
    userIds: params.memberIds,
  },
});

let benSigned = true;
let benEverSigned = false;
let userListFails = false;
let awayRanges: { userId: number; fromDay: number; toDay: number }[] = [];
let awayRangesFail = false;
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
            schema: {
              pages: formPages,
              outputViews: [{ type: "card", id: "card", blocks: [] }],
            },
          })
        : Response.json({ statusCode: 400 }, { status: 400 }),
    "POST /actions/evaluate-cohort": async ({ request }) => {
      const { expression }: { expression: { userIds: number[] } } =
        await request.json();
      return Response.json({ userIds: expression.userIds });
    },
    "GET /user/admin/awayranges": () =>
      awayRangesFail
        ? Response.json({ statusCode: 500 }, { status: 500 })
        : Response.json(
            awayRanges.map(({ userId, fromDay, toDay }) => ({
              id: userId,
              userId,
              userName: `User ${userId}`,
              startDate: new Date(
                Date.now() + fromDay * 86_400_000,
              ).toISOString(),
              endDate: new Date(Date.now() + toDay * 86_400_000).toISOString(),
            })),
          ),
    "GET /user/list": () =>
      userListFails
        ? Response.json({ statusCode: 500 }, { status: 500 })
        : Response.json([
            {
              id: 10,
              name: "Ana",
              profilePicture: null,
              hasActiveContract: true,
            },
            {
              id: 11,
              name: "Ben",
              profilePicture: null,
              hasActiveContract: benSigned,
              ...(benEverSigned && {
                lastContractEvent: {
                  type: "signed",
                  date: "2026-01-01T00:00:00.000Z",
                  automatic: false,
                  contractId: 1,
                },
              }),
            },
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
  benSigned = true;
  benEverSigned = false;
  userListFails = false;
  awayRanges = [];
  awayRangesFail = false;
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
    name: "Ready to launch",
  }))
    fireEvent.click(box);
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: "Launch anyway, breaking the contract",
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
    screen.getByText(
      "1 member is assigned more than 15 minutes. The contract assigns tasks in 15-minute blocks.",
    ),
  ).toBeTruthy();
  expect(launchButton().hasAttribute("disabled")).toBe(true);

  await resolveEveryCheck();

  await waitFor(() =>
    expect(launchButton().hasAttribute("disabled")).toBe(false),
  );
  expect(launchButton().textContent).toContain("Launch and notify 2 members");
});

it("lists each action's unfinished checklist items", async () => {
  served[2] = { ...served[2], body: "", taskFormId: null, project: null };
  renderPanel();

  expect(
    await screen.findByText(
      "Unfinished: Full body content, Part of a project, Task form linked, Task form has an output view, for the completion card",
    ),
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

  const write = (await screen.findByText(/^1 member ·/)).closest("li");
  expect(write?.textContent).not.toContain("cover image");
  expect(write?.textContent).toContain("Archived");
  expect(
    write?.querySelector('[aria-label="Edit task form"]')?.getAttribute("href"),
  ).toBe("/forms/5");
  expect(screen.getByText(/^2 members ·/)).toBeTruthy();
});

it("states how long members have to complete their actions", async () => {
  setSystemTime(new Date("2026-01-15T20:00:00Z"));
  renderPanel();
  expect(
    await screen.findByText(
      "Members have 7 days 4 hours 59 minutes to complete their actions",
    ),
  ).toBeTruthy();
});

it("counts only members with an active contract, as the server admits them", async () => {
  benSigned = false;
  renderPanel();

  expect(
    await screen.findByRole("button", { name: "Launch and notify 1 member" }),
  ).toBeTruthy();
  expect(screen.getByText(/^1 member ·/)).toBeTruthy();
  expect(screen.getByText(/^0 members ·/)).toBeTruthy();
});

it("counts no one for an action without a cohort, as the server does", async () => {
  served[1] = { ...served[1], cohortExpression: null };
  renderPanel();

  expect(
    await screen.findByRole("button", { name: "Launch and notify 1 member" }),
  ).toBeTruthy();
});

it("counts an onboarding action's unsigned members", async () => {
  benSigned = false;
  served[2] = { ...served[2], onboarding: true };
  renderPanel();

  expect(
    await screen.findByRole("button", { name: "Launch and notify 2 members" }),
  ).toBeTruthy();
});

it("leaves out of an onboarding action the members who have already signed", async () => {
  benSigned = false;
  benEverSigned = true;
  served[1] = { ...served[1], onboarding: true };
  renderPanel();

  expect(
    await screen.findByRole("button", { name: "Launch and notify 1 member" }),
  ).toBeTruthy();
});

it("leaves out members away during the launch", async () => {
  awayRanges = [{ userId: 11, fromDay: -1, toDay: 30 }];
  renderPanel();

  expect(
    await screen.findByRole("button", { name: "Launch and notify 1 member" }),
  ).toBeTruthy();
});

it("counts members away only before members start or after office taking action", async () => {
  awayRanges = [
    { userId: 10, fromDay: -10, toDay: -1 },
    { userId: 11, fromDay: 10, toDay: 20 },
  ];
  renderPanel();

  expect(
    await screen.findByRole("button", { name: "Launch and notify 2 members" }),
  ).toBeTruthy();
});

it("keeps the checks up while away dates load past the year ahead", async () => {
  const { container } = renderPanel();
  await screen.findByRole("button", { name: "Launch and notify 2 members" });
  fireEvent.click(
    screen.getAllByRole("button", {
      name: "Preview a member who gets these actions",
    })[0],
  );
  fireEvent.change(
    container.querySelectorAll('input[type="datetime-local"]')[1],
    { target: { value: "2099-01-10T10:00" } },
  );
  expect(screen.queryByText("Running checks…")).toBeNull();
  expect(launchButton().textContent).toBe("Launch and notify ? members");
  expect(screen.getByText("Actions unknown")).toBeTruthy();
  await screen.findByRole("button", { name: "Launch and notify 2 members" });
  expect(screen.queryByText("Actions unknown")).toBeNull();
});

it("blocks launch, counting no one, when members' away dates fail to load", async () => {
  awayRangesFail = true;
  renderPanel();

  expect(
    await screen.findByText("Failed to load members' away dates."),
  ).toBeTruthy();
  await waitFor(() =>
    expect(launchButton().hasAttribute("disabled")).toBe(true),
  );
  expect(screen.getAllByText(/^\? members ·/)).toHaveLength(2);
  expect(launchButton().textContent).toBe("Launch and notify ? members");
  expect(screen.queryByText("No member is assigned any action.")).toBeNull();
  expect(
    screen.getByText("Unknown until every member count loads"),
  ).toBeTruthy();
});

it("blocks launch when members' contract status fails to load", async () => {
  userListFails = true;
  renderPanel();

  expect(
    await screen.findByText("Failed to load members' contract status."),
  ).toBeTruthy();
  await waitFor(() =>
    expect(launchButton().hasAttribute("disabled")).toBe(true),
  );
  expect(screen.getByText("Some checks failed to load.")).toBeTruthy();
  expect(screen.getAllByText(/^\? members ·/)).toHaveLength(2);
  expect(launchButton().textContent).toBe("Launch and notify ? members");
  expect(screen.queryByText("No member is assigned any action.")).toBeNull();
});

it("re-runs the checks without failing the loads an action doesn't make", async () => {
  served[2] = { ...served[2], taskFormId: null };
  renderPanel();
  fireEvent.click(await screen.findByRole("button", { name: "Re-run checks" }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(
    screen.queryByText("Failed to load the task form for Write."),
  ).toBeNull();
});
