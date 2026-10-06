import type { CommunityDto } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  makeCommunity,
  makeProfile,
  makeUser,
} from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import { onlineManager } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Suspense } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import GroupDetailPage from "./GroupDetailPage";

afterEach(cleanup);

const sam = { ...makeProfile(7), displayName: "Sam" };
const lee = { ...makeProfile(8), displayName: "Lee" };
const north = makeCommunity({
  id: 4,
  name: "North",
  users: [sam],
  leaders: [lee],
});

const ada = { ...makeProfile(9), displayName: "Ada" };

let listed = north;
let listStatus = 200;
let updateStatus = 200;
let deleteStatus = 200;
let removeStatus = 200;
let addLeaderDrops = false;

serveApi(
  routes({
    "GET /community/list": () =>
      listStatus === 200
        ? Response.json([listed])
        : Response.json({ message: "Admins only" }, { status: listStatus }),
    "GET /user/list": () => Response.json([makeUser({ id: 9, name: "Ada" })]),
    "POST /community/:communityId/addMember/admin": () =>
      Response.json({ ...north, users: [sam, ada] }),
    "POST /community/:communityId/addLeader/admin": () => {
      if (addLeaderDrops) throw new TypeError("Failed to fetch");
      return Response.json({ ...north, leaders: [lee, sam] });
    },
    "GET /actions/communityMemberInfo/:communityId/admin": () =>
      Response.json({ actions: [], users: [] }),
    "GET /community/memberContactInfo/:communityId/admin": () =>
      Response.json([]),
    "POST /community/:communityId/removeMember/admin": () =>
      removeStatus === 200
        ? Response.json({ ...north, users: [] })
        : Response.json(
            { message: "Sam leads this group" },
            { status: removeStatus },
          ),
    "POST /community/:communityId/removeLeader/admin": () =>
      Response.json({ ...north, leaders: [] }),
    "PATCH /community/:communityId": async ({ request }) =>
      updateStatus === 200
        ? Response.json({ ...north, ...(await request.json()) })
        : Response.json(
            { message: "That name is taken" },
            { status: updateStatus },
          ),
    "DELETE /community/:communityId/admin": () =>
      deleteStatus === 200
        ? Response.json({})
        : Response.json(
            { message: "North still has members" },
            { status: deleteStatus },
          ),
  }),
);

afterEach(() => {
  listed = north;
  listStatus = 200;
  updateStatus = 200;
  deleteStatus = 200;
  onlineManager.setOnline(true);
  removeStatus = 200;
  addLeaderDrops = false;
});

const renderPage = (id = "4", cached?: CommunityDto[]) => {
  const query = queryWrapper();
  if (cached) query.client.setQueryData(queryKeys.communitiesAdmin(), cached);
  render(
    <MemoryRouter initialEntries={[`/groups/${id}`]}>
      <ToastProvider>
        <Routes>
          <Route path="/groups/:id" element={<GroupDetailPage />} />
          <Route path="/groups" element={<p>All groups</p>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
    query,
  );
  return query.client;
};

it("shows the group with that id", async () => {
  renderPage();

  expect(await screen.findByRole("heading", { name: "North" })).toBeTruthy();
});

it("says when no group has that id", async () => {
  renderPage("9");

  expect(await screen.findByText("Community not found.")).toBeTruthy();
});

it("drops a removed member", async () => {
  renderPage();
  await screen.findByText("Sam");

  fireEvent.click(screen.getByRole("button", { name: "Remove" }));

  expect(
    await screen.findByText("No members yet. Add someone above."),
  ).toBeTruthy();
});

it("says why a removal was refused", async () => {
  removeStatus = 400;
  renderPage();
  await screen.findByText("Sam");

  fireEvent.click(screen.getByRole("button", { name: "Remove" }));

  expect(await screen.findAllByText("Sam leads this group")).toHaveLength(2);
  expect(screen.getByText("Sam")).toBeTruthy();
});

it("goes back to the groups once a group is deleted", async () => {
  renderPage();
  await screen.findByRole("heading", { name: "North" });

  fireEvent.click(screen.getByRole("button", { name: "Delete group" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Delete community" }),
  );

  expect(await screen.findByText("All groups")).toBeTruthy();
});

it("never says a just-deleted group is missing", async () => {
  const LoadingGroups = () => {
    throw new Promise(() => {});
  };
  render(
    <MemoryRouter initialEntries={["/groups/4"]}>
      <ToastProvider>
        <Suspense>
          <Routes>
            <Route path="/groups/:id" element={<GroupDetailPage />} />
            <Route path="/groups" element={<LoadingGroups />} />
          </Routes>
        </Suspense>
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );
  await screen.findByRole("heading", { name: "North" });

  fireEvent.click(screen.getByRole("button", { name: "Delete group" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Delete community" }),
  );
  await screen.findByText("Community deleted");

  expect(screen.queryByText("Community not found.")).toBeNull();
});

it("shows the saved details", async () => {
  renderPage();
  fireEvent.change(await screen.findByDisplayValue("North"), {
    target: { value: "Northwest" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(
    await screen.findByRole("heading", { level: 1, name: "Northwest" }),
  ).toBeTruthy();
});

it("drops a removed leader", async () => {
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "Remove leader" }));

  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Remove leader" })).toBeNull(),
  );
});

it("says when the id is not a number", async () => {
  renderPage("abc");

  expect(await screen.findByText("Invalid community id.")).toBeTruthy();
});

it("says the id is not a number without waiting for the groups", async () => {
  onlineManager.setOnline(false);
  renderPage("abc");

  expect(await screen.findByText("Invalid community id.")).toBeTruthy();
});

it("keeps unsaved details when the group refetches with changes", async () => {
  const client = renderPage();
  const description = await screen.findByDisplayValue("A group");
  fireEvent.change(description, { target: { value: "Unsaved edit" } });

  listed = { ...north, description: "Newer details", users: [sam, ada] };
  await client.invalidateQueries();

  await screen.findByText("Ada");
  expect(screen.getByDisplayValue("Unsaved edit")).toBeTruthy();
});

it("adds the picked member and clears the picker", async () => {
  renderPage();
  await screen.findByText("Sam");
  const picker = screen
    .getByText("Add member", { selector: "label" })
    .parentElement!.querySelector("input")!;

  fireEvent.change(picker, { target: { value: "Ada" } });
  fireEvent.click(await screen.findByRole("button", { name: /Ada/ }));
  fireEvent.click(screen.getByRole("button", { name: "Add member" }));

  expect(await screen.findByText("Ada")).toBeTruthy();
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Add member" })).toHaveProperty(
      "disabled",
      true,
    ),
  );
});

const promoteSam = async () => {
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: "Make leader" }));
  await waitFor(() =>
    expect(screen.getAllByRole("button", { name: "Make leader" })).toHaveLength(
      2,
    ),
  );
  const [, confirm] = screen.getAllByRole("button", { name: "Make leader" });
  fireEvent.click(confirm);
};

it("promotes a member to leader", async () => {
  await promoteSam();

  await waitFor(() =>
    expect(
      screen.getAllByRole("button", { name: "Remove leader" }),
    ).toHaveLength(2),
  );
});

it("shows the action's fallback when a write never reaches the server", async () => {
  addLeaderDrops = true;
  await promoteSam();

  expect(
    await screen.findAllByText("Unable to promote leader. Please try again."),
  ).toHaveLength(2);
});

it("says why loading the group was refused", async () => {
  listStatus = 403;
  renderPage();

  expect(await screen.findByText("Admins only")).toBeTruthy();
  expect(screen.queryByText("Community not found.")).toBeNull();
});

it("says why saving the details was refused, keeping the edit", async () => {
  updateStatus = 400;
  renderPage();
  fireEvent.change(await screen.findByDisplayValue("North"), {
    target: { value: "South" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findAllByText("That name is taken")).toHaveLength(2);
  expect(screen.getByDisplayValue("South")).toBeTruthy();
});

it("keeps loading while offline rather than saying the group is missing", async () => {
  onlineManager.setOnline(false);
  renderPage();

  expect(await screen.findByText("Loading community…")).toBeTruthy();
  expect(screen.queryByText("Community not found.")).toBeNull();
});

it("adds the picked leader and clears the picker", async () => {
  renderPage();
  await screen.findByText("Sam");
  const picker = screen
    .getByText("Add leader", { selector: "label" })
    .parentElement!.querySelector("input")!;

  fireEvent.change(picker, { target: { value: "Ada" } });
  fireEvent.click(await screen.findByRole("button", { name: /Ada/ }));
  fireEvent.click(screen.getByRole("button", { name: "Add leader" }));

  await waitFor(() =>
    expect(
      screen.getAllByRole("button", { name: "Remove leader" }),
    ).toHaveLength(2),
  );
  expect(screen.getByRole("button", { name: "Add leader" })).toHaveProperty(
    "disabled",
    true,
  );
});

it("says why a delete was refused and stays on the group", async () => {
  deleteStatus = 400;
  renderPage();
  await screen.findByRole("heading", { level: 1, name: "North" });

  fireEvent.click(screen.getByRole("button", { name: "Delete group" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Delete community" }),
  );

  expect(await screen.findAllByText("North still has members")).toHaveLength(2);
  expect(screen.queryByText("All groups")).toBeNull();
});

it("waits for the refetch when the cached list predates the group", async () => {
  renderPage("4", []);

  expect(screen.getByText("Loading community…")).toBeTruthy();
  expect(
    await screen.findByRole("heading", { level: 1, name: "North" }),
  ).toBeTruthy();
});

it("keeps loading offline when the cached list predates the group", async () => {
  onlineManager.setOnline(false);
  renderPage("4", []);

  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.getByText("Loading community…")).toBeTruthy();
  expect(screen.queryByText("Community not found.")).toBeNull();
});

it("says why the refetch failed when the cached list predates the group", async () => {
  listStatus = 403;
  renderPage("4", []);

  expect(await screen.findByText("Admins only")).toBeTruthy();
  expect(screen.queryByText("Community not found.")).toBeNull();
});

it("brings newer details into an untouched form when the refetch lands", async () => {
  listed = { ...north, description: "Fresh description" };
  renderPage("4", [north]);

  expect(await screen.findByDisplayValue("Fresh description")).toBeTruthy();
});
