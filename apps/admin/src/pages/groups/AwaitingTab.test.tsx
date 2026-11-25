import type { CommunityDto, UserDto } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  makeCommunity,
  makeProfile,
  makeUser,
} from "@alliance/shared/lib/testFixtures";
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
import { ToastProvider } from "../../ui/ToastProvider";
import GroupsPage from "./GroupsPage";

afterEach(cleanup);

const sam = makeUser({ id: 7, name: "Sam" });

let listStatus = 200;
let listCalls = 0;
let north = makeCommunity({ id: 4, name: "North" });
let assignStatus = 200;
let queue: UserDto[] = [sam];

serveApi(
  routes({
    "GET /community/list": () => {
      listCalls += 1;
      return listStatus === 200
        ? Response.json([north])
        : Response.json({ message: "Admins only" }, { status: listStatus });
    },
    "POST /user/groupAssignment/members": () => Response.json(queue),
    "POST /user/groupAssignment/assign": () =>
      assignStatus === 200
        ? Response.json({})
        : Response.json({ message: "North is full" }, { status: assignStatus }),
  }),
);

afterEach(() => {
  listStatus = 200;
  listCalls = 0;
  north = makeCommunity({ id: 4, name: "North" });
  assignStatus = 200;
  queue = [sam];
  localStorage.clear();
});

const renderTab = () => {
  const query = queryWrapper();
  query.client.setQueryData(queryKeys.groupAssignmentMembersAdmin(), queue);
  render(
    <MemoryRouter initialEntries={["/members/groups?tab=awaiting"]}>
      <ToastProvider>
        <GroupsPage />
      </ToastProvider>
    </MemoryRouter>,
    query,
  );
  return query.client;
};

const assignToNorth = async () => {
  const client = renderTab();
  await screen.findByRole("option", { name: "North" });

  fireEvent.change(screen.getByLabelText("New group for Sam"), {
    target: { value: "4" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm assignments" }));
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Assign member",
    }),
  );
  return client;
};

it("offers the groups once they load", async () => {
  renderTab();

  expect(screen.getByRole("option", { name: "Loading groups…" })).toBeTruthy();
  expect(await screen.findByRole("option", { name: "North" })).toBeTruthy();
});

it("keeps a stored pick when the queue loads after the page, and drops one for a member no longer waiting", async () => {
  localStorage.setItem(
    "admin.groupAssignmentSelections",
    JSON.stringify({ 7: "4", 99: "4" }),
  );
  render(
    <MemoryRouter initialEntries={["/members/groups?tab=awaiting"]}>
      <ToastProvider>
        <GroupsPage />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );
  await screen.findByRole("option", { name: "North" });

  await waitFor(() =>
    expect(
      screen.getByLabelText<HTMLSelectElement>("New group for Sam").value,
    ).toBe("4"),
  );
  expect(localStorage.getItem("admin.groupAssignmentSelections")).toBe(
    JSON.stringify({ 7: "4" }),
  );
});

it("says when the groups failed to load", async () => {
  listStatus = 500;
  renderTab();

  expect(await screen.findByText(/Couldn't load groups\./)).toBeTruthy();
});

it("takes the assigned members off the queue and refreshes the groups", async () => {
  const client = await assignToNorth();

  await waitFor(() =>
    expect(
      client.getQueryData(queryKeys.groupAssignmentMembersAdmin()),
    ).toEqual([]),
  );
  await waitFor(() => expect(listCalls).toBe(2));
  expect(localStorage.getItem("admin.groupAssignmentSelections")).toBe("{}");
});

it("says why an assignment was refused, keeping the members queued", async () => {
  assignStatus = 400;
  const client = await assignToNorth();

  expect(await screen.findByText("North is full")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Assign member" })).toBeNull();
  await waitFor(() =>
    expect(
      client.getQueryData(queryKeys.groupAssignmentMembersAdmin()),
    ).toEqual([sam]),
  );
});

it("says why loading the groups was refused", async () => {
  listStatus = 403;
  renderTab();

  expect(await screen.findByText(/Admins only/)).toBeTruthy();
});

it("keeps the loaded groups when the refetch after an assignment fails", async () => {
  const client = await assignToNorth();
  listStatus = 500;

  await waitFor(() => expect(listCalls).toBe(2));
  expect(screen.queryByText(/Couldn't load groups\./)).toBeNull();
  expect(
    client.getQueryData<CommunityDto[]>(queryKeys.communitiesAdmin())?.[0].name,
  ).toBe("North");
});

it("names the groups an assignment takes a member out of", async () => {
  queue = [
    makeUser({
      id: 7,
      name: "Sam",
      communities: [
        { ...makeCommunity({ id: 6, name: "East" }), users: [], leaders: [] },
      ],
    }),
  ];
  renderTab();
  await screen.findByRole("option", { name: "North" });
  expect(screen.getByRole("link", { name: "East" }).getAttribute("href")).toBe(
    "/members/groups/6",
  );

  fireEvent.change(screen.getByLabelText("New group for Sam"), {
    target: { value: "4" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm assignments" }));

  expect(
    within(screen.getByRole("dialog")).getByText(
      "Sam: (Remove from: East) → North",
    ),
  ).toBeTruthy();
});

it("asks for a selection before confirming", async () => {
  renderTab();
  await screen.findByRole("option", { name: "North" });

  fireEvent.click(screen.getByRole("button", { name: "Confirm assignments" }));

  expect(
    await screen.findByText(
      "Select at least one group assignment before confirming.",
    ),
  ).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("shows and blocks a pick whose group stopped taking staff assignments", async () => {
  north = makeCommunity({
    id: 4,
    name: "North",
    maxCapacity: 5,
    allowStaffAssignments: false,
  });
  localStorage.setItem(
    "admin.groupAssignmentSelections",
    JSON.stringify({ 7: "4" }),
  );
  renderTab();

  expect(
    await screen.findByText("This group is not available for assignment."),
  ).toBeTruthy();
  expect(screen.getByRole<HTMLSelectElement>("combobox").value).toBe("4");

  fireEvent.click(screen.getByRole("button", { name: "Confirm assignments" }));

  expect(
    await screen.findByText(
      "Fix the selections marked below before confirming.",
    ),
  ).toBeTruthy();
});

it("blocks queued assignments that outnumber a group's free seats", async () => {
  north = makeCommunity({
    id: 4,
    name: "North",
    maxCapacity: 2,
    users: [makeProfile(1)],
  });
  queue = [sam, makeUser({ id: 8, name: "Kim" })];
  localStorage.setItem(
    "admin.groupAssignmentSelections",
    JSON.stringify({ 7: "4", 8: "4" }),
  );
  renderTab();

  expect(await screen.findAllByText("Over capacity by 1.")).toHaveLength(2);

  fireEvent.click(screen.getByRole("button", { name: "Confirm assignments" }));

  expect(
    await screen.findByText(
      "Fix the selections marked below before confirming.",
    ),
  ).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
});
