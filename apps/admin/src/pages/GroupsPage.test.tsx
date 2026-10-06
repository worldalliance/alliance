import { makeCommunity } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { onlineManager } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { GroupAssignmentProvider } from "../lib/GroupAssignmentContext";
import GroupsPage from "./GroupsPage";

afterEach(cleanup);

const north = makeCommunity({ id: 4, name: "North" });

let listStatus = 200;
let createStatus = 200;

serveApi(
  routes({
    "GET /community/list": () =>
      listStatus === 200
        ? Response.json([north])
        : Response.json({}, { status: listStatus }),
    "POST /user/groupAssignment/members": () => Response.json([]),
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
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <GroupAssignmentProvider>
        <GroupsPage />
      </GroupAssignmentProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

const fillAndCreate = () => {
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "South" },
  });
  fireEvent.change(screen.getByPlaceholderText("What is this group for?"), {
    target: { value: "A group" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create group" }));
};

it("lists the groups, showing unused capacity once they load", async () => {
  renderPage();

  expect(screen.queryByText("Unused capacity")).toBeNull();
  expect(await screen.findByText("North")).toBeTruthy();
  expect(screen.getByText("Unused capacity")).toBeTruthy();
});

it("says when the groups failed to load", async () => {
  listStatus = 500;
  renderPage();

  expect(
    await screen.findByText("Unable to load communities. Please try again."),
  ).toBeTruthy();
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

  expect(await screen.findByText("That name is taken")).toBeTruthy();
});

it("keeps loading while offline rather than saying there are no groups", async () => {
  onlineManager.setOnline(false);
  renderPage();

  expect(await screen.findByText("Loading groups…")).toBeTruthy();
  expect(screen.queryByText("No groups yet.")).toBeNull();
  expect(screen.queryByText("Unused capacity")).toBeNull();
});
