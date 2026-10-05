import type { UserAdminDetailDto } from "@alliance/shared/client/types.gen";
import { makeCommunity, makeUser } from "@alliance/shared/lib/testFixtures";
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
import MemberGroupMoveSection from "./MemberGroupMoveSection";

afterEach(cleanup);

const north = makeCommunity({ id: 4, name: "North" });
const south = makeCommunity({ id: 5, name: "South" });

const user: UserAdminDetailDto = {
  ...makeUser({ id: 7, name: "Sam", hasActiveContract: true }),
  communities: [{ ...north, users: [], leaders: [] }],
  location: {},
  invitedBy: null,
};

let listCalls = 0;
let listStatus = 200;
let moveStatus = 200;
let detailStatus = 200;
let addStatus = 200;
const moves: unknown[] = [];
const adds: unknown[] = [];

serveApi(
  routes({
    "GET /community/list": () => {
      listCalls += 1;
      return listStatus === 200
        ? Response.json([north, south])
        : Response.json({}, { status: listStatus });
    },
    "POST /community/:communityId/moveMember/admin": async ({
      request,
      params,
    }) => {
      moves.push({ from: params.communityId, body: await request.json() });
      return moveStatus === 200
        ? Response.json({})
        : Response.json({ message: "South is full" }, { status: moveStatus });
    },
    "POST /community/:communityId/addMember/admin": async ({
      request,
      params,
    }) => {
      adds.push({ to: params.communityId, body: await request.json() });
      return addStatus === 200
        ? Response.json({ ...south, users: [] })
        : Response.json({ message: "South is full" }, { status: addStatus });
    },
    "GET /user/userdetail/:id": () =>
      detailStatus === 200
        ? Response.json({
            ...user,
            communities: [{ ...south, users: [], leaders: [] }],
          })
        : Response.json({}, { status: detailStatus }),
  }),
);

afterEach(() => {
  listCalls = 0;
  listStatus = 200;
  moveStatus = 200;
  detailStatus = 200;
  addStatus = 200;
  moves.length = 0;
  adds.length = 0;
});

const submitTo = async (params: {
  member: UserAdminDetailDto;
  field: string;
  button: string;
}) => {
  const onUserUpdated = jest.fn();
  render(
    <MemoryRouter>
      <ToastProvider>
        <MemberGroupMoveSection
          user={params.member}
          onUserUpdated={onUserUpdated}
        />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );
  fireEvent.change(await screen.findByLabelText(params.field), {
    target: { value: "5" },
  });
  fireEvent.click(screen.getByRole("button", { name: params.button }));
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: params.button })).toHaveLength(
      2,
    ),
  );
  const [, confirm] = screen.getAllByRole("button", { name: params.button });
  fireEvent.click(confirm);
  return onUserUpdated;
};

const moveToSouth = () =>
  submitTo({ member: user, field: "Move to", button: "Move member" });

it("moves the member and refreshes the groups and the member", async () => {
  const onUserUpdated = await moveToSouth();

  await waitFor(() => expect(onUserUpdated).toHaveBeenCalled());
  expect(moves).toEqual([
    { from: "4", body: { userId: 7, destinationCommunityId: 5 } },
  ]);
  await waitFor(() => expect(listCalls).toBe(2));
});

it("says to reload when the member could not refresh", async () => {
  detailStatus = 500;
  await moveToSouth();

  expect(
    await screen.findByText(
      "Membership was updated, but the page could not refresh. Reload to see their latest groups.",
    ),
  ).toBeTruthy();
});

it("assigns a member with no group", async () => {
  const onUserUpdated = await submitTo({
    member: { ...user, communities: [] },
    field: "Assign to",
    button: "Assign member",
  });

  await waitFor(() => expect(onUserUpdated).toHaveBeenCalled());
  expect(adds).toEqual([{ to: "5", body: { userId: 7 } }]);
});

it("hides a server error's own text behind the assign fallback", async () => {
  addStatus = 500;
  const onUserUpdated = await submitTo({
    member: { ...user, communities: [] },
    field: "Assign to",
    button: "Assign member",
  });

  expect(await screen.findByText("Could not assign this member.")).toBeTruthy();
  expect(onUserUpdated).not.toHaveBeenCalled();
});

const renderSection = () =>
  render(
    <MemoryRouter>
      <ToastProvider>
        <MemberGroupMoveSection user={user} onUserUpdated={() => {}} />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

it("says it is loading the groups rather than that none has room", async () => {
  renderSection();

  expect(
    screen.getByRole("option", { name: "Loading groups..." }),
  ).toBeTruthy();
  expect(
    screen.queryByText(
      "No groups with staff assignments and available capacity.",
    ),
  ).toBeNull();
  expect(await screen.findByRole("option", { name: "South" })).toBeTruthy();
});

it("says when the groups failed to load", async () => {
  listStatus = 500;
  renderSection();

  expect(await screen.findByText("Unable to load groups.")).toBeTruthy();
  expect(
    screen.queryByText(
      "No groups with staff assignments and available capacity.",
    ),
  ).toBeNull();
});

it("says why a move was refused and refreshes the groups", async () => {
  moveStatus = 400;
  const onUserUpdated = await moveToSouth();

  expect(await screen.findByText("South is full")).toBeTruthy();
  await waitFor(() => expect(listCalls).toBe(2));
  expect(onUserUpdated).not.toHaveBeenCalled();
});

it("hides a server error's own text behind the move fallback", async () => {
  moveStatus = 500;
  await moveToSouth();

  expect(await screen.findByText("Could not move this member.")).toBeTruthy();
});
