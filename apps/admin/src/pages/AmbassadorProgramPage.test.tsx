import type {
  AmbassadorInviteGoalWithStatsDto,
  AmbassadorProgramMemberDto,
} from "@alliance/shared/client";
import { makeTag, makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import AmbassadorProgramPage from "./AmbassadorProgramPage";

afterEach(cleanup);

const makeGoal = (
  id: number,
  recruits: { target: number; successful: number },
): AmbassadorInviteGoalWithStatsDto => ({
  goal: {
    id,
    targetSuccessfulRecruits: recruits.target,
    startAt: "2026-10-01T00:00:00.000Z",
    dueAt: "2026-10-31T00:00:00.000Z",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
  },
  stats: {
    totalInvitesSent: 7,
    totalAcceptedInvites: 5,
    totalSuccessfulRecruits: 4,
    goalSuccessfulRecruits: recruits.successful,
  },
});

const makeMember = (
  overrides: Partial<AmbassadorProgramMemberDto> & { userId: number },
): AmbassadorProgramMemberDto => ({
  id: overrides.userId,
  invited: false,
  activeParticipant: false,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  user: makeUser({ id: overrides.userId }),
  interactions: [],
  ...overrides,
});

const invitee = makeMember({
  userId: 1,
  invited: true,
  user: makeUser({
    id: 1,
    name: "Ivy Invitee",
    email: "ivy@example.com",
    tags: [{ ...makeTag({ id: "tag-9", name: "Organizer" }), users: [] }],
  }),
  interactions: [
    {
      id: 11,
      text: "Called about the program",
      interactionDate: "2026-10-03",
      createdAt: "2026-10-03T00:00:00.000Z",
    },
  ],
  inviteStats: {
    totals: {
      totalInvitesSent: 0,
      totalAcceptedInvites: 0,
      totalSuccessfulRecruits: 0,
      goalSuccessfulRecruits: 0,
    },
    currentGoal: makeGoal(30, { target: 50, successful: 0 }),
    pastGoals: [],
    upcomingGoals: [],
  },
});

const participant = makeMember({
  userId: 2,
  activeParticipant: true,
  user: makeUser({ id: 2, name: "Pat Participant", ambassador: true }),
  inviteStats: {
    totals: {
      totalInvitesSent: 12,
      totalAcceptedInvites: 8,
      totalSuccessfulRecruits: 6,
      goalSuccessfulRecruits: 0,
    },
    currentGoal: makeGoal(21, { target: 10, successful: 3 }),
    pastGoals: [makeGoal(20, { target: 5, successful: 5 })],
    upcomingGoals: [],
  },
});

const calls: { method: string; path: string; body: unknown }[] = [];
const record = async ({ request }: { request: Request }) => {
  calls.push({
    method: request.method,
    path: new URL(request.url).pathname,
    body: await request.json(),
  });
  return Response.json({});
};

const api = serveApi(
  routes({
    "GET /user/ambassadorProgram": () =>
      Response.json({
        members: [invitee, participant],
        projection: {
          generatedAt: "2026-10-05T00:00:00.000Z",
          points: [
            {
              date: "2026-10-31T00:00:00.000Z",
              projectedSuccessfulRecruits: 4,
            },
          ],
        },
      }),
    "GET /user/list-graph": () =>
      Response.json([
        makeUser({ id: 1, name: "Ivy Invitee" }),
        makeUser({ id: 2, name: "Pat Participant" }),
        makeUser({ id: 3, name: "Sam Pool" }),
      ]),
  }),
);

beforeEach(() => {
  calls.length = 0;
});

const renderPage = async () => {
  const { wrapper } = queryWrapper();
  render(
    <MemoryRouter>
      <AmbassadorProgramPage />
    </MemoryRouter>,
    { wrapper },
  );
  await screen.findByRole("link", { name: "Ivy Invitee" });
  await screen.findAllByRole("option", { name: "Sam Pool" });
};

const section = (title: string) => {
  const heading = screen.getByRole("heading", { name: title });
  const element = heading.closest("section");
  if (!element) throw new Error(`no section for ${title}`);
  return within(element);
};

it("offers the member pool, minus the section's members, when adding", async () => {
  await renderPage();

  expect(
    section("Invited")
      .getAllByRole("option")
      .map((option) => option.textContent),
  ).toEqual(["Select member", "Pat Participant", "Sam Pool"]);
  expect(
    section("Active participants")
      .getAllByRole("option")
      .map((option) => option.textContent),
  ).toEqual(["Select member", "Ivy Invitee", "Sam Pool"]);
});

it("narrows the add picker by the pool search", async () => {
  await renderPage();
  const invited = section("Invited");

  fireEvent.change(invited.getByPlaceholderText("Search member pool"), {
    target: { value: "sam" },
  });

  expect(
    invited.getAllByRole("option").map((option) => option.textContent),
  ).toEqual(["Select member", "Sam Pool"]);
});

it.each([
  { title: "Invited", button: "Add invited member", flag: { invited: true } },
  {
    title: "Active participants",
    button: "Add participant",
    flag: { activeParticipant: true },
  },
])("adds a pool member to $title", async ({ title, button, flag }) => {
  api.alsoServing({ "POST /user/ambassadorProgram/member": record });
  await renderPage();
  const target = section(title);

  fireEvent.change(target.getByRole("combobox"), { target: { value: "3" } });
  fireEvent.click(target.getByRole("button", { name: button }));

  await waitFor(() =>
    expect(calls).toEqual([
      {
        method: "POST",
        path: "/user/ambassadorProgram/member",
        body: { userId: 3, ...flag },
      },
    ]),
  );
});

it.each([
  {
    title: "Invited",
    button: "Remove invited",
    userId: 1,
    body: { invited: false },
  },
  {
    title: "Active participants",
    button: "Remove participant",
    userId: 2,
    body: { activeParticipant: false },
  },
])(
  "removes a member from only $title",
  async ({ title, button, userId, body }) => {
    api.alsoServing({
      "PATCH /user/ambassadorProgram/member/:userId": record,
    });
    await renderPage();

    fireEvent.click(section(title).getByRole("button", { name: button }));

    await waitFor(() =>
      expect(calls).toEqual([
        {
          method: "PATCH",
          path: `/user/ambassadorProgram/member/${userId}`,
          body,
        },
      ]),
    );
  },
);

it("records a trimmed interaction note on the member's date", async () => {
  api.alsoServing({ "POST /user/ambassadorProgram/interaction": record });
  await renderPage();
  const invited = section("Invited");

  fireEvent.change(invited.getByPlaceholderText("Add interaction note"), {
    target: { value: "  Sent a follow-up  " },
  });
  fireEvent.change(invited.getByDisplayValue(/^\d{4}-\d{2}-\d{2}$/), {
    target: { value: "2026-10-04" },
  });
  fireEvent.click(invited.getByRole("button", { name: "Add entry" }));

  await waitFor(() =>
    expect(calls).toEqual([
      {
        method: "POST",
        path: "/user/ambassadorProgram/interaction",
        body: {
          userId: 1,
          text: "Sent a follow-up",
          interactionDate: "2026-10-04",
        },
      },
    ]),
  );
});

it("lists a member's past interactions", async () => {
  await renderPage();

  expect(section("Invited").getByText("Called about the program")).toBeTruthy();
});

it.each(["invitee", "ivy@", "organizer"])(
  "filters records by %p",
  async (term) => {
    await renderPage();

    fireEvent.change(screen.getByPlaceholderText("Filter records"), {
      target: { value: term },
    });

    expect(screen.getByRole("link", { name: "Ivy Invitee" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Pat Participant" })).toBeNull();
    expect(
      section("Active participants").getByText("No active participants yet."),
    ).toBeTruthy();
  },
);

it("shows invite goals for active participants and the remaining target", async () => {
  await renderPage();
  const active = section("Active participants");

  expect(active.getByText("Current goal")).toBeTruthy();
  expect(active.getByText("Past growth periods (1)")).toBeTruthy();
  expect(active.getByText("3 / 10")).toBeTruthy();
  expect(section("Invited").queryByText("Ambassador invite goals")).toBeNull();

  const projection = section("Projected growth");
  expect(
    projection.getByText("Active goal target left").nextSibling?.textContent,
  ).toBe("7");
  expect(projection.getByText(/^By /).nextSibling?.textContent).toBe("4");
});
