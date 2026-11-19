import type { UserDto } from "@alliance/shared/client/types.gen";
import { makeCommunity, makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { onlineManager } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import GroupsPage from "./GroupsPage";

afterEach(cleanup);

const north = makeCommunity({ id: 4, name: "North" });

let listStatus = 200;
let createStatus = 200;
let queue: UserDto[] = [];
let queueStatus = 200;

serveApi(
  routes({
    "GET /community/list": () =>
      listStatus === 200
        ? Response.json([north])
        : Response.json({}, { status: listStatus }),
    "POST /user/groupAssignment/members": () =>
      queueStatus === 200
        ? Response.json(queue)
        : Response.json({}, { status: queueStatus }),
    "POST /user/groupAssignment/assign": () => {
      queue = [];
      return Response.json({});
    },
    "POST /community/create/admin": async ({ request }) => {
      if (createStatus !== 200)
        return Response.json(
          { message: "That name is taken" },
          { status: createStatus },
        );
      const { name }: { name: string } = await request.json();
      return Response.json(makeCommunity({ id: 5, name }));
    },
  }),
);

afterEach(() => {
  onlineManager.setOnline(true);
  listStatus = 200;
  createStatus = 200;
  queue = [];
  queueStatus = 200;
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <GroupsPage />
    </MemoryRouter>,
    queryWrapper(),
  );

const fillAndCreate = () => {
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "South" },
  });
  fireEvent.change(screen.getByLabelText("Description"), {
    target: { value: "A group" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create group" }));
};

it("lists the groups, showing unused capacity once they load", async () => {
  renderPage();

  expect(screen.queryByText("Unused capacity")).toBeNull();
  expect(await screen.findByText("North")).toBeTruthy();
  expect(screen.getByText("Unused capacity")).toBeTruthy();
  expect(
    screen.getAllByRole("heading").map((heading) => heading.textContent),
  ).toEqual(["Groups", "All groups", "North", "Create group"]);
});

it("says when the groups failed to load", async () => {
  listStatus = 500;
  renderPage();

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Unable to load communities. Please try again.",
  );
});

it("announces a failed groups load once while members await assignment", async () => {
  listStatus = 500;
  queue = [makeUser({ id: 9, name: "Ada" })];
  renderPage();

  await screen.findByText("Unable to load groups. Please try again.");
  expect(
    screen.getAllByRole("alert").map((alert) => alert.textContent),
  ).toEqual(["Unable to load communities. Please try again."]);
});

it("lists a created group and clears the form", async () => {
  renderPage();
  await screen.findByText("North");

  fillAndCreate();

  expect(await screen.findByText("South")).toBeTruthy();
  expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("");
});

it("says why a create was refused", async () => {
  createStatus = 400;
  renderPage();
  await screen.findByText("North");

  fillAndCreate();

  expect((await screen.findByRole("alert")).textContent).toBe(
    "That name is taken",
  );
});

it("keeps loading while offline rather than saying there are no groups", async () => {
  onlineManager.setOnline(false);
  renderPage();

  expect(await screen.findByText("Loading groups…")).toBeTruthy();
  expect(screen.queryByText("No groups yet.")).toBeNull();
  expect(screen.queryByText("Unused capacity")).toBeNull();
});

it("creates a group without a description", async () => {
  renderPage();
  await screen.findByText("North");

  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "South" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create group" }));

  expect(await screen.findByText("South")).toBeTruthy();
});

it("says when the members awaiting assignment failed to load", async () => {
  queueStatus = 500;
  renderPage();

  expect((await screen.findByRole("alert")).textContent).toBe(
    "Unable to load members awaiting group assignment. Please try again.",
  );
});

it("closes the assignment panel once its last member is assigned", async () => {
  queue = [makeUser({ id: 7, name: "Sam" })];
  renderPage();
  await screen.findByRole("option", { name: "North" });

  fireEvent.change(screen.getByLabelText("New group"), {
    target: { value: "4" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm assignments" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirm" }));

  await waitFor(() =>
    expect(screen.queryByText("Group assignment")).toBeNull(),
  );
});
