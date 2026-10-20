import type {
  UpdateUserRolesAdminDto,
  UserAdminDetailDto,
} from "@alliance/shared/client/types.gen";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { makeTag, makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { renderHook, waitFor } from "@testing-library/react";
import { omit } from "es-toolkit";
import { useUserDetailAdmin } from "./useUserDetailAdmin";

const tagDto = makeTag();
const volunteers = omit(tagDto, ["users"]);

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
let tagStatus: number;
let tagWrites: unknown[];

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
    "POST /user/tags/:tagId/addUser": async ({ request, params }) => {
      tagWrites.push({ add: params.tagId, body: await request.json() });
      if (tagStatus !== 200) return Response.json({}, { status: tagStatus });
      stored = { ...stored, tags: [...stored.tags, volunteers] };
      return Response.json(tagDto);
    },
    "POST /user/tags/:tagId/removeUser": async ({ request, params }) => {
      tagWrites.push({ remove: params.tagId, body: await request.json() });
      stored = { ...stored, tags: [] };
      return Response.json(tagDto);
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
  tagStatus = 200;
  tagWrites = [];
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

  it("adds the tag, refetches the member and invalidates the tag list", async () => {
    const { client, view } = await renderLoaded();
    client.setQueryData(queryKeys.tagsAdmin(), []);

    await expect(
      view.result.current.setTagMembership.mutateAsync({
        tagId: "tag-1",
        member: true,
      }),
    ).resolves.toEqual(tagDto);

    expect(tagWrites).toEqual([{ add: "tag-1", body: { userId: 7 } }]);
    expect(
      client.getQueryData<UserAdminDetailDto>(queryKeys.userDetailAdmin(7))
        ?.tags,
    ).toEqual([volunteers]);
    expect(client.getQueryState(queryKeys.tagsAdmin())?.isInvalidated).toBe(
      true,
    );
  });

  it("removes the tag from the cached member", async () => {
    stored = { ...member, tags: [volunteers] };
    const { client, wrapper } = queryWrapper();
    const view = renderHook(() => useUserDetailAdmin(7), { wrapper });
    await waitFor(() => expect(view.result.current.query.data).toBeDefined());

    await view.result.current.setTagMembership.mutateAsync({
      tagId: "tag-1",
      member: false,
    });

    expect(tagWrites).toEqual([{ remove: "tag-1", body: { userId: 7 } }]);
    expect(
      client.getQueryData<UserAdminDetailDto>(queryKeys.userDetailAdmin(7))
        ?.tags,
    ).toEqual([]);
  });

  it("rejects a refused tag change and keeps the cached member", async () => {
    tagStatus = 500;
    const { client, view } = await renderLoaded();

    await expect(
      view.result.current.setTagMembership.mutateAsync({
        tagId: "tag-1",
        member: true,
      }),
    ).rejects.toBeDefined();
    expect(client.getQueryData(queryKeys.userDetailAdmin(7))).toEqual(member);
  });

  it("keeps a suspension whose refetch a tag change interrupts", async () => {
    const { client, view } = await renderLoaded();
    detailDelay = 100;

    const suspending = view.result.current.suspendContract.mutateAsync();
    await waitFor(() => expect(detailLoads).toBe(2));
    await view.result.current.setTagMembership.mutateAsync({
      tagId: "tag-1",
      member: true,
    });
    await suspending;

    expect(client.getQueryData(queryKeys.userDetailAdmin(7))).toEqual({
      ...member,
      hasActiveContract: false,
      tags: [volunteers],
    });
  });

  it("settles a tag change only once the refetch that replaced its own lands", async () => {
    const { client, view } = await renderLoaded();
    detailDelay = 100;

    const adding = view.result.current.setTagMembership.mutateAsync({
      tagId: "tag-1",
      member: true,
    });
    await waitFor(() => expect(detailLoads).toBe(2));
    void view.result.current.setTagMembership.mutateAsync({
      tagId: "tag-1",
      member: false,
    });
    await adding;

    expect(detailLoads).toBe(3);
    expect(
      client.getQueryState(queryKeys.userDetailAdmin(7))?.fetchStatus,
    ).toBe("idle");
  });

  it("rejects a refresh whose refetch fails", async () => {
    const { view } = await renderLoaded();
    detailStatus = 500;

    await expect(view.result.current.refresh()).rejects.toBeDefined();
  });
});
