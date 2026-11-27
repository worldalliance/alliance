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
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { Suspense, type ReactNode } from "react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import LeaveGuard from "../../components/LeaveGuard";
import { ToastProvider } from "../../ui/ToastProvider";
import { pickUser } from "../../ui/UserSelect.testing";
import GroupPage from "./GroupPage";

afterEach(cleanup);

export const sam = { ...makeProfile(7), displayName: "Sam" };
export const lee = { ...makeProfile(8), displayName: "Lee" };
export const north = makeCommunity({
  id: 4,
  name: "North",
  users: [sam],
  leaders: [lee],
});

export const ada = { ...makeProfile(9), displayName: "Ada" };

export const api = {
  listed: north,
  listStatus: 200,
  listHeld: null as Promise<void> | null,
  releaseList: () => {},
  updateStatus: 200,
  deleteStatus: 200,
  removeStatus: 200,
  addLeaderDrops: false,
  memberInfoStatus: 200,
  memberInfoRequests: 0,
  userListRequests: 0,
  contactInfoStatus: 200,
};

/** Each test file calls this: the module loads once per run, so top-level hooks would attach to the first file only. */
export const serveGroupPageApi = () => {
  serveApi(
    routes({
      "GET /community/list": async () => {
        await api.listHeld;
        return api.listStatus === 200
          ? Response.json([api.listed])
          : Response.json(
              { message: "Admins only" },
              { status: api.listStatus },
            );
      },
      "GET /user/list": () => {
        api.userListRequests += 1;
        return Response.json([makeUser({ id: 9, name: "Ada" })]);
      },
      "POST /community/:communityId/addMember/admin": () =>
        Response.json({ ...north, users: [sam, ada] }),
      "POST /community/:communityId/addLeader/admin": () => {
        if (api.addLeaderDrops) throw new TypeError("Failed to fetch");
        return Response.json({ ...north, leaders: [lee, sam] });
      },
      "GET /actions/communityMemberInfo/:communityId/admin": () => {
        api.memberInfoRequests += 1;
        return api.memberInfoStatus === 200
          ? Response.json({ actions: [], users: [] })
          : Response.json(
              { message: "Members only" },
              { status: api.memberInfoStatus },
            );
      },
      "GET /community/memberContactInfo/:communityId/admin": () =>
        api.contactInfoStatus === 200
          ? Response.json([])
          : Response.json(
              { message: "Contact info is private" },
              { status: api.contactInfoStatus },
            ),
      "POST /community/:communityId/removeMember/admin": () =>
        api.removeStatus === 200
          ? Response.json({ ...north, users: [] })
          : Response.json(
              { message: "Sam leads this group" },
              { status: api.removeStatus },
            ),
      "POST /community/:communityId/removeLeader/admin": () =>
        Response.json({ ...north, leaders: [] }),
      "PATCH /community/:communityId": async ({ request }) =>
        api.updateStatus === 200
          ? Response.json({ ...north, ...(await request.json()) })
          : Response.json(
              { message: "That name is taken" },
              { status: api.updateStatus },
            ),
      "DELETE /community/:communityId/admin": () =>
        api.deleteStatus === 200
          ? Response.json({})
          : Response.json(
              { message: "North still has members" },
              { status: api.deleteStatus },
            ),
    }),
  );

  afterEach(() => {
    api.listed = north;
    api.listStatus = 200;
    api.releaseList();
    api.listHeld = null;
    api.updateStatus = 200;
    api.deleteStatus = 200;
    onlineManager.setOnline(true);
    api.removeStatus = 200;
    api.addLeaderDrops = false;
    api.memberInfoStatus = 200;
    api.memberInfoRequests = 0;
    api.userListRequests = 0;
    api.contactInfoStatus = 200;
  });
};

export const renderPage = (
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

export const members = () =>
  within(screen.getByRole("region", { name: "Leaders and members" }));

/** Presses a row's button, then the same-named button of the confirmation it opens. */
export const pressAndConfirm = async (row: string, confirm: string) => {
  fireEvent.click(await screen.findByRole("button", { name: row }));
  fireEvent.click(
    within(await screen.findByRole("dialog")).getByRole("button", {
      name: confirm,
    }),
  );
};

export const deleteNorth = async () => {
  await screen.findByRole("heading", { level: 1, name: "North" });
  await pressAndConfirm("Delete group", "Delete group");
};

export const addAda = async (params: {
  open: string;
  pick: string;
  add: string;
}) => {
  renderPage();
  fireEvent.click(await screen.findByRole("button", { name: params.open }));
  const dialog = within(await screen.findByRole("dialog"));
  const picker = dialog
    .getByText(params.pick, { selector: "label" })
    .parentElement!.querySelector("input")!;

  await pickUser(picker, { query: "Ada", name: /Ada/ });
  fireEvent.click(dialog.getByRole("button", { name: params.add }));
};

export const leaderRemovals = () =>
  screen.getAllByRole("button", { name: /^Remove leader: / });
