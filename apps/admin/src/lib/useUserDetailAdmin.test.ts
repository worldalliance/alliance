import type {
  UpdateUserRolesAdminDto,
  UserAdminDetailDto,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useUserDetailAdmin } from "./useUserDetailAdmin";

afterEach(cleanup);

const member: UserAdminDetailDto = {
  ...makeUser({ id: 7, name: "Sam", hasActiveContract: true }),
  communities: [],
  tags: [],
  location: {},
  invitedBy: null,
};

let stored: UserAdminDetailDto;
let detailStatus: number;
let rolesStatus: number;
let suspendStatus: number;
let detailLoads: number;
let detailDelay: number;
let suspended: string[];

serveApi(
  routes({
    "GET /user/userdetail/:id": async () => {
      detailLoads += 1;
      const snapshot = stored;
      await new Promise((resolve) => setTimeout(resolve, detailDelay));
      return detailStatus === 200
        ? Response.json(snapshot)
        : Response.json(
            { message: "User not found" },
            { status: detailStatus },
          );
    },
    "PATCH /user/userdetail/:id/roles": async ({ request }) => {
      const body: UpdateUserRolesAdminDto = await request.json();
      if (rolesStatus !== 200) {
        return Response.json(
          { message: "Cannot remove your own admin role" },
          { status: rolesStatus },
        );
      }
      stored = { ...stored, staff: body.staff ?? stored.staff };
      return Response.json(stored);
    },
    "POST /contract/admin/suspend/:userId": ({ params }) => {
      if (suspendStatus !== 200) {
        return Response.json({}, { status: suspendStatus });
      }
      suspended.push(params.userId);
      stored = { ...stored, hasActiveContract: false };
      return Response.json({ date: "2026-10-16T00:00:00.000Z" });
    },
  }),
);

beforeEach(() => {
  stored = member;
  detailStatus = 200;
  rolesStatus = 200;
  suspendStatus = 200;
  detailLoads = 0;
  detailDelay = 0;
  suspended = [];
});

const renderLoaded = async () => {
  const { client, wrapper } = queryWrapper();
  const view = renderHook(() => useUserDetailAdmin(7), { wrapper });
  await waitFor(() => expect(view.result.current.query.data).toEqual(member));
  return { client, view };
};

describe("useUserDetailAdmin", () => {
  it("reads the member and caches it under their id", async () => {
    const { client } = await renderLoaded();

    expect(client.getQueryData(queryKeys.userDetailAdmin(7))).toEqual(member);
  });

  it("reports a member that is not found", async () => {
    detailStatus = 404;
    const view = renderHook(() => useUserDetailAdmin(7), queryWrapper());

    await waitFor(() => expect(view.result.current.query.isError).toBe(true));
    expect(view.result.current.query.data).toBeUndefined();
  });

  it("caches the member a role change returns without refetching", async () => {
    const { client, view } = await renderLoaded();

    await view.result.current.updateRoles.mutateAsync({ staff: true });

    expect(client.getQueryData(queryKeys.userDetailAdmin(7))).toEqual({
      ...member,
      staff: true,
    });
    expect(detailLoads).toBe(1);
  });

  it("rejects a refused role change and keeps the cached member", async () => {
    rolesStatus = 400;
    const { client, view } = await renderLoaded();

    await expect(
      view.result.current.updateRoles.mutateAsync({ staff: true }),
    ).rejects.toBeDefined();
    expect(client.getQueryData(queryKeys.userDetailAdmin(7))).toEqual(member);
  });

  it("refetches the member after suspending their contract", async () => {
    const { client, view } = await renderLoaded();

    await view.result.current.suspendContract.mutateAsync();

    expect(suspended).toEqual(["7"]);
    expect(client.getQueryData(queryKeys.userDetailAdmin(7))).toEqual({
      ...member,
      hasActiveContract: false,
    });
  });

  it("settles a suspension only once a refetch that replaced its own lands", async () => {
    const { client, view } = await renderLoaded();
    detailDelay = 100;

    const suspending = view.result.current.suspendContract.mutateAsync();
    await waitFor(() => expect(detailLoads).toBe(2));
    void view.result.current.refresh();
    await suspending;

    expect(detailLoads).toBe(3);
    expect(client.getQueryData(queryKeys.userDetailAdmin(7))).toEqual({
      ...member,
      hasActiveContract: false,
    });
  });

  it("reports a suspension as done when only its refetch fails", async () => {
    const { client, view } = await renderLoaded();
    detailStatus = 500;

    await view.result.current.suspendContract.mutateAsync();

    expect(suspended).toEqual(["7"]);
    expect(client.getQueryData(queryKeys.userDetailAdmin(7))).toEqual(member);
  });

  it("rejects a failed suspension without refetching", async () => {
    suspendStatus = 500;
    const { view } = await renderLoaded();

    await expect(
      view.result.current.suspendContract.mutateAsync(),
    ).rejects.toBeDefined();
    expect(detailLoads).toBe(1);
  });

  it("rejects a refresh whose refetch fails", async () => {
    const { view } = await renderLoaded();
    detailStatus = 500;

    await expect(view.result.current.refresh()).rejects.toBeDefined();
  });
});
