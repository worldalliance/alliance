import { makeCommunity, makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router";
import GroupAssignmentPanel from "./GroupAssignmentPanel";

afterEach(cleanup);

let listStatus = 200;
let listCalls = 0;
let assignStatus = 200;

serveApi(
  routes({
    "GET /community/list": () => {
      listCalls += 1;
      return listStatus === 200
        ? Response.json([makeCommunity({ id: 4, name: "North" })])
        : Response.json({ message: "Admins only" }, { status: listStatus });
    },
    "POST /user/groupAssignment/assign": () =>
      assignStatus === 200
        ? Response.json({})
        : Response.json({ message: "North is full" }, { status: assignStatus }),
  }),
);

const assignMembers = jest.fn();

afterEach(() => {
  listStatus = 200;
  listCalls = 0;
  assignStatus = 200;
  localStorage.clear();
  assignMembers.mockClear();
});

const members = [makeUser({ id: 7, name: "Sam" })];

const Page = () => {
  const [, setCounts] = useState<Record<number, number>>({});
  return (
    <GroupAssignmentPanel
      members={members}
      assignMembers={assignMembers}
      onSelectionCountsChange={setCounts}
    />
  );
};

const renderPanel = () =>
  render(
    <MemoryRouter>
      <Page />
    </MemoryRouter>,
    queryWrapper(),
  );

const assignToNorth = async () => {
  renderPanel();
  await screen.findByRole("option", { name: "North" });

  fireEvent.change(screen.getByLabelText("New group"), {
    target: { value: "4" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm assignments" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
};

it("offers the groups once they load", async () => {
  renderPanel();

  expect(
    screen.getByRole("option", { name: "Loading groups..." }),
  ).toBeTruthy();
  expect(await screen.findByRole("option", { name: "North" })).toBeTruthy();
});

it("says when the groups failed to load", async () => {
  listStatus = 500;
  renderPanel();

  expect(
    await screen.findByText("Unable to load groups. Please try again."),
  ).toBeTruthy();
});

it("hands back the assigned members and refreshes the groups", async () => {
  await assignToNorth();

  await waitFor(() => expect(assignMembers).toHaveBeenCalledWith([7]));
  await waitFor(() => expect(listCalls).toBe(2));
});

it("says why an assignment was refused, keeping the members queued", async () => {
  assignStatus = 400;
  await assignToNorth();

  expect(await screen.findByText("North is full")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
  expect(assignMembers).not.toHaveBeenCalled();
});

it("says why loading the groups was refused", async () => {
  listStatus = 403;
  renderPanel();

  expect(await screen.findByText("Admins only")).toBeTruthy();
});

it("keeps the loaded groups when the refetch after an assignment fails", async () => {
  await assignToNorth();
  listStatus = 500;

  await waitFor(() => expect(listCalls).toBe(2));
  expect(
    screen.queryByText("Unable to load groups. Please try again."),
  ).toBeNull();
  expect(screen.getByRole("option", { name: "North" })).toBeTruthy();
});
