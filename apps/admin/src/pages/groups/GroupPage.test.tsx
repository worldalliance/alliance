import type { CommunityDto } from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import {
  makeCommunity,
  makeProfile,
  makeUser,
} from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { Suspense, type ReactNode } from "react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import LeaveGuard from "../../components/LeaveGuard";
import { ToastProvider } from "../../ui/ToastProvider";
import GroupPage from "./GroupPage";

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
let listHeld: Promise<void> | null = null;
let releaseList = () => {};
let updateStatus = 200;
let deleteStatus = 200;
let removeStatus = 200;
let addLeaderDrops = false;
let memberInfoStatus = 200;
let memberInfoRequests = 0;
let userListRequests = 0;
let contactInfoStatus = 200;

serveApi(
  routes({
    "GET /community/list": async () => {
      await listHeld;
      return listStatus === 200
        ? Response.json([listed])
        : Response.json({ message: "Admins only" }, { status: listStatus });
    },
    "GET /user/list": () => {
      userListRequests += 1;
      return Response.json([makeUser({ id: 9, name: "Ada" })]);
    },
    "POST /community/:communityId/addMember/admin": () =>
      Response.json({ ...north, users: [sam, ada] }),
    "POST /community/:communityId/addLeader/admin": () => {
      if (addLeaderDrops) throw new TypeError("Failed to fetch");
      return Response.json({ ...north, leaders: [lee, sam] });
    },
    "GET /actions/communityMemberInfo/:communityId/admin": () => {
      memberInfoRequests += 1;
      return memberInfoStatus === 200
        ? Response.json({ actions: [], users: [] })
        : Response.json(
            { message: "Members only" },
            { status: memberInfoStatus },
          );
    },
    "GET /community/memberContactInfo/:communityId/admin": () =>
      contactInfoStatus === 200
        ? Response.json([])
        : Response.json(
            { message: "Contact info is private" },
            { status: contactInfoStatus },
          ),
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
  releaseList();
  listHeld = null;
  updateStatus = 200;
  deleteStatus = 200;
  onlineManager.setOnline(true);
  removeStatus = 200;
  addLeaderDrops = false;
  memberInfoStatus = 200;
  memberInfoRequests = 0;
  userListRequests = 0;
  contactInfoStatus = 200;
});

const renderPage = (
  params: {
    id?: string;
    tab?: "progress" | "settings";
    cached?: CommunityDto[];
    list?: ReactNode;
  } = {},
) => {
  const { id = "4", tab, cached, list = <p>Groups list</p> } = params;
  const query = queryWrapper();
  if (cached) query.client.setQueryData(queryKeys.communitiesAdmin(), cached);
  const router = createMemoryRouter(
    [
      {
        element: (
          <LeaveGuard>
            <Suspense>
              <Outlet />
            </Suspense>
          </LeaveGuard>
        ),
        children: [
          { path: "/members/groups/:id", element: <GroupPage /> },
          { path: "/members/groups", element: list },
        ],
      },
    ],
    { initialEntries: [`/members/groups/${id}${tab ? `?tab=${tab}` : ""}`] },
  );
  render(
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>,
    query,
  );
  return query.client;
};

const members = () =>
  within(screen.getByRole("region", { name: "Leaders and members" }));

/** Presses a row's button, then the same-named button of the confirmation it opens. */
const pressAndConfirm = async (row: string, confirm: string) => {
  fireEvent.click(await screen.findByRole("button", { name: row }));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: confirm,
    }),
  );
};

const deleteNorth = async () => {
  await screen.findByRole("heading", { level: 1, name: "North" });
  await pressAndConfirm("Delete group", "Delete group");
};

it("shows the group with that id", async () => {
  renderPage();

  expect(await screen.findByRole("heading", { name: "North" })).toBeTruthy();
});

it("says when no group has that id", async () => {
  renderPage({ id: "9" });

  expect(await screen.findByText("Group not found")).toBeTruthy();
});

it("drops a removed member and moves focus to the row beside it", async () => {
  renderPage();

  await pressAndConfirm("Remove from group: Sam", "Remove from group");

  await waitFor(() =>
    expect(members().queryByRole("link", { name: "Sam" })).toBeNull(),
  );
  await waitFor(() =>
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "Remove leader: Lee",
    ),
  );
});

it("keeps a member whose removal is not confirmed", async () => {
  renderPage();
  fireEvent.click(
    await screen.findByRole("button", { name: "Remove from group: Sam" }),
  );

  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: "Cancel",
    }),
  );

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(members().getByRole("link", { name: "Sam" })).toBeTruthy();
  expect(memberInfoRequests).toBe(1);
});

it("says why a removal was refused", async () => {
  removeStatus = 400;
  renderPage();

  await pressAndConfirm("Remove from group: Sam", "Remove from group");

  expect(await screen.findByText("Sam leads this group")).toBeTruthy();
  expect(members().getByRole("link", { name: "Sam" })).toBeTruthy();
});

it("goes back to the groups once a group is deleted", async () => {
  renderPage();

  await deleteNorth();

  expect(await screen.findByText("Groups list")).toBeTruthy();
});

it("deletes a group with unsaved settings without asking to leave", async () => {
  const asked = jest.spyOn(window, "confirm").mockReturnValue(false);
  try {
    renderPage({ tab: "settings" });
    fireEvent.change(await screen.findByLabelText("Name"), {
      target: { value: "Northern" },
    });

    await pressAndConfirm("Delete group", "Delete group");

    expect(await screen.findByText("Groups list")).toBeTruthy();
    expect(asked).not.toHaveBeenCalled();
  } finally {
    asked.mockRestore();
  }
});

it("never says a just-deleted group is missing", async () => {
  const LoadingGroups = () => {
    throw new Promise(() => {});
  };
  renderPage({ list: <LoadingGroups /> });

  await deleteNorth();
  await screen.findByText("Group deleted");

  expect(screen.queryByText("Group not found")).toBeNull();
});

it("shows the saved details", async () => {
  renderPage({ tab: "settings" });
  fireEvent.change(await screen.findByLabelText("Name"), {
    target: { value: "Northwest" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(
    await screen.findByRole("heading", { level: 1, name: "Northwest" }),
  ).toBeTruthy();
  expect(await screen.findByText("Saved")).toBeTruthy();
});

it("says why the details are invalid", async () => {
  renderPage({ tab: "settings" });
  fireEvent.change(await screen.findByLabelText("Name"), {
    target: { value: "   " },
  });

  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByText("Name is required")).toBeTruthy();
});

it("saves the details with the description cleared", async () => {
  renderPage({ tab: "settings" });
  fireEvent.change(await screen.findByLabelText(/^Description/), {
    target: { value: "" },
  });
  fireEvent.change(screen.getByLabelText("Name"), {
    target: { value: "Northwest" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(
    await screen.findByRole("heading", { level: 1, name: "Northwest" }),
  ).toBeTruthy();
});

it("saves a capacity below the member count", async () => {
  listed = { ...north, users: [sam, ada, lee] };
  renderPage({ tab: "settings" });
  fireEvent.change(await screen.findByDisplayValue("10"), {
    target: { value: "1" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByText("Group updated")).toBeTruthy();
});

it("puts back the saved details on Discard", async () => {
  renderPage({ tab: "settings" });
  fireEvent.change(await screen.findByLabelText("Name"), {
    target: { value: "Northwest" },
  });
  expect(screen.getByText("Unsaved changes")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Discard" }));

  expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("North");
});

it("drops a removed leader", async () => {
  renderPage();

  await pressAndConfirm("Remove leader: Lee", "Remove leader");

  await waitFor(() =>
    expect(members().queryByRole("link", { name: "Lee" })).toBeNull(),
  );
});

it("says when the id is not a number", async () => {
  renderPage({ id: "abc" });

  expect(await screen.findByText("Group not found")).toBeTruthy();
});

it("says the id is not a number without waiting for the groups", async () => {
  onlineManager.setOnline(false);
  renderPage({ id: "abc" });

  expect(await screen.findByText("Group not found")).toBeTruthy();
});

it("keeps unsaved details when the group refetches with changes", async () => {
  const client = renderPage({ tab: "settings" });
  const description = await screen.findByLabelText(/^Description/);
  fireEvent.change(description, { target: { value: "Unsaved edit" } });

  listed = { ...north, description: "Newer details", users: [sam, ada] };
  await client.invalidateQueries();

  await screen.findByText(/^1 member ·/);
  expect(screen.getByDisplayValue("Unsaved edit")).toBeTruthy();
});

const addAda = async (params: { open: string; pick: string; add: string }) => {
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: params.open }));
  const dialog = within(await screen.findByRole("dialog"));
  const picker = dialog
    .getByText(params.pick, { selector: "label" })
    .parentElement!.querySelector("input")!;

  fireEvent.change(picker, { target: { value: "Ada" } });
  fireEvent.click(await dialog.findByRole("button", { name: /Ada/ }));
  fireEvent.click(dialog.getByRole("button", { name: params.add }));
};

it("adds the picked member and closes the picker", async () => {
  await addAda({
    open: "Add member…",
    pick: "Member to add",
    add: "Add member",
  });

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(members().getByRole("link", { name: "Ada" })).toBeTruthy();
});

const leaderRemovals = () =>
  screen.getAllByRole("button", { name: /^Remove leader: / });

it("promotes a member to leader", async () => {
  renderPage();

  await pressAndConfirm("Make leader: Sam", "Make leader");

  await waitFor(() => expect(leaderRemovals()).toHaveLength(2));
});

it("shows the action's fallback when a write never reaches the server", async () => {
  addLeaderDrops = true;
  renderPage();

  await pressAndConfirm("Make leader: Sam", "Make leader");

  expect(await screen.findByText("Couldn't make them a leader.")).toBeTruthy();
});

it("says why loading the group was refused", async () => {
  listStatus = 403;
  renderPage();

  expect(await screen.findByText("Admins only")).toBeTruthy();
  expect(screen.queryByText("Group not found")).toBeNull();
});

it("says why saving the details was refused, keeping the edit", async () => {
  updateStatus = 400;
  renderPage({ tab: "settings" });
  fireEvent.change(await screen.findByLabelText("Name"), {
    target: { value: "South" },
  });

  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(await screen.findByText(/That name is taken/)).toBeTruthy();
  expect(screen.getByDisplayValue("South")).toBeTruthy();
});

it("keeps loading while offline rather than saying the group is missing", async () => {
  onlineManager.setOnline(false);
  renderPage();

  expect(await screen.findByRole("status", { name: "Loading" })).toBeTruthy();
  expect(screen.queryByText("Group not found")).toBeNull();
});

it("adds the picked leader and closes the picker", async () => {
  await addAda({
    open: "Add leader…",
    pick: "Leader to add",
    add: "Add leader",
  });

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(leaderRemovals()).toHaveLength(2);
});

it("shows a failed add in its dialog alone", async () => {
  addLeaderDrops = true;
  await addAda({
    open: "Add leader…",
    pick: "Leader to add",
    add: "Add leader",
  });

  const refusal = await screen.findByText("Couldn't add the leader.");
  expect(screen.getByRole("dialog").contains(refusal)).toBe(true);
});

it("says why a delete was refused and stays on the group", async () => {
  deleteStatus = 400;
  renderPage();

  await deleteNorth();

  expect(await screen.findByText("North still has members")).toBeTruthy();
  expect(screen.queryByText("Groups list")).toBeNull();
});

it("waits for the refetch when the cached list predates the group", async () => {
  renderPage({ cached: [] });

  expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
  expect(
    await screen.findByRole("heading", { level: 1, name: "North" }),
  ).toBeTruthy();
});

it("keeps loading offline when the cached list predates the group", async () => {
  onlineManager.setOnline(false);
  renderPage({ cached: [] });

  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
  expect(screen.queryByText("Group not found")).toBeNull();
});

it("says why the refetch failed when the cached list predates the group", async () => {
  listStatus = 403;
  renderPage({ cached: [] });

  expect(await screen.findByText("Admins only")).toBeTruthy();
  expect(screen.queryByText("Group not found")).toBeNull();
});

it("brings newer details into an untouched form when the refetch lands", async () => {
  listed = { ...north, description: "Fresh description" };
  renderPage({ tab: "settings", cached: [north] });

  expect(await screen.findByDisplayValue("Fresh description")).toBeTruthy();
});

it("says why loading the member details was refused", async () => {
  memberInfoStatus = 403;
  renderPage({ tab: "progress" });

  expect(await screen.findByText("Members only")).toBeTruthy();
});

it("says why loading the members' contact info was refused", async () => {
  contactInfoStatus = 403;
  renderPage({ tab: "progress" });

  expect(await screen.findByText(/Contact info is private/)).toBeTruthy();
});

it("loads the member details and users alongside the group", async () => {
  listHeld = new Promise((resolve) => {
    releaseList = resolve;
  });
  renderPage();

  await waitFor(() => expect(memberInfoRequests).toBe(1));
  await waitFor(() => expect(userListRequests).toBe(1));
});

it("reloads the member details after a membership change", async () => {
  renderPage();
  await screen.findByRole("button", { name: "Remove from group: Sam" });
  await waitFor(() => expect(memberInfoRequests).toBe(1));

  await pressAndConfirm("Remove from group: Sam", "Remove from group");

  await waitFor(() => expect(memberInfoRequests).toBe(2));
});

it("says a failed load once when the cached list predates the group", async () => {
  listStatus = 403;
  renderPage({ cached: [] });

  expect(await screen.findByText("Admins only")).toBeTruthy();
  expect(screen.queryByText(/Couldn't refresh/)).toBeNull();
});

it("says when the members' contact info fails to refresh", async () => {
  const client = renderPage({ tab: "progress" });
  await screen.findByRole("heading", { level: 1, name: "North" });
  await waitFor(() =>
    expect(
      client.getQueryState(queryKeys.communityMemberContactInfoAdmin(4))
        ?.status,
    ).toBe("success"),
  );
  contactInfoStatus = 403;
  await act(() =>
    client.refetchQueries({
      queryKey: queryKeys.communityMemberContactInfoAdmin(4),
    }),
  );

  expect(
    await screen.findByText(
      /Couldn't refresh the members' contact details\. Contact info is private/,
    ),
  ).toBeTruthy();
});

it("says nothing of the contact details' refresh while progress has failed", async () => {
  memberInfoStatus = 500;
  const client = renderPage({ tab: "progress" });
  await screen.findByText("Couldn't load progress");
  await waitFor(() =>
    expect(
      client.getQueryState(queryKeys.communityMemberContactInfoAdmin(4))
        ?.status,
    ).toBe("success"),
  );
  contactInfoStatus = 403;
  await act(() =>
    client.refetchQueries({
      queryKey: queryKeys.communityMemberContactInfoAdmin(4),
    }),
  );

  await waitFor(() =>
    expect(
      client.getQueryState(queryKeys.communityMemberContactInfoAdmin(4))
        ?.status,
    ).toBe("error"),
  );
  expect(
    screen.queryByText(/Couldn't refresh the members' contact/),
  ).toBeNull();
});
