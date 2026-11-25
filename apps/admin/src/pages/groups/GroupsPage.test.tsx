import type { CommunityDto, UserDto } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
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
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useParams } from "react-router";
import { ToastProvider } from "../../ui/ToastProvider";
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
  localStorage.clear();
});

const GroupRecord = () => <p>Group record {useParams().id}</p>;

const renderPage = (url = "/members/groups") => {
  const query = queryWrapper();
  render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <Routes>
          <Route path="/members/groups" element={<GroupsPage />} />
          <Route path="/members/groups/:id" element={<GroupRecord />} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
    query,
  );
  return query.client;
};

const fillAndCreate = async (description?: string) => {
  fireEvent.click(screen.getByRole("button", { name: "New group…" }));
  const dialog = within(await screen.findByRole("dialog"));
  fireEvent.change(dialog.getByLabelText("Name"), {
    target: { value: "South" },
  });
  if (description !== undefined) {
    fireEvent.change(dialog.getByLabelText(/^Description/), {
      target: { value: description },
    });
  }
  fireEvent.click(dialog.getByRole("button", { name: "Create group" }));
  return dialog;
};

it("lists the groups, showing unused capacity once they load", async () => {
  renderPage();

  expect(screen.getByText("Unused capacity —")).toBeTruthy();
  expect(await screen.findByRole("link", { name: "North" })).toBeTruthy();
  expect(await screen.findByText(/^Unused capacity \d/)).toBeTruthy();
});

it("links each group to its record", async () => {
  renderPage();

  expect(
    (await screen.findByRole("link", { name: "North" })).getAttribute("href"),
  ).toBe("/members/groups/4");
});

it("says when the groups failed to load", async () => {
  listStatus = 500;
  renderPage();

  expect(await screen.findByText("Couldn't load groups")).toBeTruthy();
  expect(screen.getByText("The server didn't answer. Try again.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});

it("opens a created group, which the list then holds", async () => {
  const client = renderPage();
  await screen.findByRole("link", { name: "North" });

  await fillAndCreate("A group");

  expect(await screen.findByText("Group record 5")).toBeTruthy();
  expect(
    client
      .getQueryData<CommunityDto[]>(queryKeys.communitiesAdmin())
      ?.map((group) => group.name),
  ).toEqual(["North", "South"]);
});

it("says why a create was refused, keeping what was typed", async () => {
  createStatus = 400;
  renderPage();
  await screen.findByRole("link", { name: "North" });

  const dialog = await fillAndCreate("A group");

  expect(await dialog.findByText("That name is taken")).toBeTruthy();
  expect(dialog.getByLabelText<HTMLInputElement>("Name").value).toBe("South");
});

it("says what is wrong with a new group on the field that fixes it", async () => {
  renderPage();
  await screen.findByRole("link", { name: "North" });
  fireEvent.click(screen.getByRole("button", { name: "New group…" }));
  const dialog = within(await screen.findByRole("dialog"));

  fireEvent.click(dialog.getByRole("button", { name: "Create group" }));

  expect(await dialog.findByText("Name is required")).toBeTruthy();
  expect(dialog.getByLabelText("Name").getAttribute("aria-invalid")).toBe(
    "true",
  );
});

it("keeps loading while offline rather than saying there are no groups", async () => {
  onlineManager.setOnline(false);
  renderPage();

  expect(await screen.findByRole("status", { name: "Loading" })).toBeTruthy();
  expect(screen.queryByText("No groups yet")).toBeNull();
  expect(screen.getByText("Unused capacity —")).toBeTruthy();
});

it("creates a group without a description", async () => {
  renderPage();
  await screen.findByRole("link", { name: "North" });

  await fillAndCreate();

  expect(await screen.findByText("Group record 5")).toBeTruthy();
});

it("says when the members awaiting assignment failed to load", async () => {
  queueStatus = 500;
  renderPage();

  expect(
    await screen.findByText(/Couldn't load the members awaiting a group\./),
  ).toBeTruthy();
});

it("filters the groups by name, in the URL, and says when none match", async () => {
  renderPage("/members/groups?q=sou");

  expect(await screen.findByText("No results")).toBeTruthy();
  expect(screen.queryByRole("link", { name: "North" })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

  expect(await screen.findByRole("link", { name: "North" })).toBeTruthy();
});

it("counts the members awaiting a group on their tab", async () => {
  queue = [makeUser({ id: 7, name: "Sam" })];
  renderPage();

  await waitFor(() =>
    expect(
      screen.getByRole("tab", { name: /Awaiting assignment/ }).textContent,
    ).toBe("Awaiting assignment1"),
  );
});

it("shows the selections awaiting confirmation against their group", async () => {
  queue = [makeUser({ id: 7, name: "Sam" })];
  localStorage.setItem(
    "admin.groupAssignmentSelections",
    JSON.stringify({ 7: "4" }),
  );
  renderPage();

  const north = (await screen.findByRole("link", { name: "North" })).closest(
    "tr",
  );
  const cells = [...(north?.querySelectorAll("td") ?? [])].map(
    (cell) => cell.textContent,
  );
  expect(cells[5]).toBe("1");
});

it("holds the picks column while the queue is not loaded", async () => {
  queueStatus = 500;
  localStorage.setItem(
    "admin.groupAssignmentSelections",
    JSON.stringify({ 7: "4" }),
  );
  renderPage();

  await screen.findByRole("link", { name: "North" });
  expect(
    screen.getByRole("columnheader", { name: "Picked, unconfirmed" }),
  ).toBeTruthy();
});

it("says no one is awaiting a group once the last member is assigned", async () => {
  queue = [makeUser({ id: 7, name: "Sam" })];
  renderPage("/members/groups?tab=awaiting");
  await screen.findByRole("option", { name: "North" });

  fireEvent.change(screen.getByLabelText("New group for Sam"), {
    target: { value: "4" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm assignments" }));
  fireEvent.click(screen.getByRole("button", { name: "Assign member" }));

  expect(await screen.findByText("No one is awaiting a group")).toBeTruthy();
});
