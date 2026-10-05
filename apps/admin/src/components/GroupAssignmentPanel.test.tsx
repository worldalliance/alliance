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
import { MemoryRouter } from "react-router";
import GroupAssignmentPanel from "./GroupAssignmentPanel";

afterEach(cleanup);

let assignStatus = 200;

serveApi(
  routes({
    "GET /community/list": () =>
      Response.json([makeCommunity({ id: 4, name: "North" })]),
    "POST /user/groupAssignment/assign": () =>
      assignStatus === 200
        ? Response.json({})
        : Response.json({ message: "North is full" }, { status: assignStatus }),
  }),
);

const assignMembers = jest.fn();

afterEach(() => {
  assignStatus = 200;
  localStorage.clear();
  assignMembers.mockClear();
});

const assignToNorth = async () => {
  render(
    <MemoryRouter>
      <GroupAssignmentPanel
        members={[makeUser({ id: 7, name: "Sam" })]}
        assignMembers={assignMembers}
      />
    </MemoryRouter>,
    queryWrapper(),
  );
  await screen.findByRole("option", { name: "North" });

  fireEvent.change(screen.getByLabelText("New group"), {
    target: { value: "4" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm assignments" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
};

it("hands back the assigned members", async () => {
  await assignToNorth();

  await waitFor(() => expect(assignMembers).toHaveBeenCalledWith([7]));
});

it("says why an assignment was refused, keeping the members queued", async () => {
  assignStatus = 400;
  await assignToNorth();

  expect(await screen.findByText("North is full")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Confirm" })).toBeNull();
  expect(assignMembers).not.toHaveBeenCalled();
});
