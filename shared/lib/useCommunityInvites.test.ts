import { act, renderHook, waitFor } from "@testing-library/react";
import type { CommunityInviteDto } from "../client/types.gen";
import { makeCommunity } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useCommunityInvites } from "./useCommunityInvites";

const invite = (id: number): CommunityInviteDto => ({
  id,
  status: "invitee_pending",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  community: makeCommunity({ id: 7 }),
});

let requested: string[] = [];
let created: unknown[] = [];
let deleted: string[] = [];
let respondToDelete: () => Response;
let serverInvites: CommunityInviteDto[];
let holdingLists: Promise<void> | null;
let holdingCreate: Promise<void> | null;

const served = serveApi(
  routes({
    "GET /community/communityInvites/community/:communityId": ({ params }) => {
      requested.push(params.communityId);
      const read = [...serverInvites];
      return (holdingLists ?? Promise.resolve()).then(() =>
        Response.json(read),
      );
    },
    "POST /community/communityInvites/create": async ({ request }) => {
      created.push(await request.json());
      serverInvites = [invite(3), ...serverInvites];
      await holdingCreate;
      return Response.json(invite(3));
    },
    "DELETE /community/communityInvites/:inviteId": ({ params }) => {
      deleted.push(params.inviteId);
      const response = respondToDelete();
      if (response.ok) {
        serverInvites = serverInvites.filter(
          (i) => i.id !== Number(params.inviteId),
        );
      }
      return response;
    },
  }),
);

beforeEach(() => {
  requested = [];
  created = [];
  deleted = [];
  respondToDelete = () => new Response(null, { status: 200 });
  serverInvites = [invite(1), invite(2)];
  holdingLists = null;
  holdingCreate = null;
});

const holdLists = () => {
  const held = Promise.withResolvers<void>();
  holdingLists = held.promise;
  return () => {
    holdingLists = null;
    held.resolve();
  };
};

type Hook = Awaited<ReturnType<typeof renderLoaded>>;

const renderLoaded = async () => {
  const { wrapper } = queryWrapper();
  const hook = renderHook(() => useCommunityInvites(7), { wrapper });
  await waitFor(() => expect(hook.result.current.invites).toHaveLength(2));
  return hook;
};

it("loads a community's invites", async () => {
  const hook = await renderLoaded();

  expect(hook.result.current.invites).toEqual([invite(1), invite(2)]);
  expect(requested).toEqual(["7"]);
});

it("puts a created invite first without refetching", async () => {
  const hook = await renderLoaded();

  await act(() => hook.result.current.createInvite(9));

  expect(created).toEqual([{ invitedUserId: 9, communityId: 7 }]);
  await waitFor(() =>
    expect(hook.result.current.invites.map((i) => i.id)).toEqual([3, 1, 2]),
  );
  expect(requested).toEqual(["7"]);
});

it("drops a deleted invite without refetching", async () => {
  const hook = await renderLoaded();

  await act(() => hook.result.current.deleteInvite(1));

  expect(deleted).toEqual(["1"]);
  await waitFor(() => expect(hook.result.current.invites).toEqual([invite(2)]));
  expect(requested).toEqual(["7"]);
});

it.each([
  {
    write: "delete",
    run: (hook: Hook): Promise<unknown> => hook.result.current.deleteInvite(1),
    expected: [4, 2],
  },
  {
    write: "create",
    run: (hook: Hook): Promise<unknown> => hook.result.current.createInvite(9),
    expected: [3, 4, 1, 2],
  },
])(
  "keeps a $write and the refetch it overlapped",
  async ({ run, expected }) => {
    const hook = await renderLoaded();
    serverInvites = [invite(4), ...serverInvites];
    const release = holdLists();
    void hook.result.current.refetch();
    await waitFor(() => expect(hook.result.current.isFetching).toBe(true));

    await act(() => run(hook));
    release();

    await waitFor(() => expect(hook.result.current.isFetching).toBe(false));
    expect(hook.result.current.invites.map((i) => i.id)).toEqual(expected);
  },
);

it("keeps the first load when an invite is created before it lands", async () => {
  const release = holdLists();
  const { wrapper } = queryWrapper();
  const hook = renderHook(() => useCommunityInvites(7), { wrapper });
  await waitFor(() => expect(hook.result.current.isFetching).toBe(true));

  await act(() => hook.result.current.createInvite(9));
  release();

  await waitFor(() =>
    expect(hook.result.current.invites.map((i) => i.id)).toEqual([3, 1, 2]),
  );
});

it("lists a created invite once when a refetch already read it", async () => {
  const hook = await renderLoaded();
  const held = Promise.withResolvers<void>();
  holdingCreate = held.promise;

  const creating = hook.result.current.createInvite(9);
  await waitFor(() => expect(created).toHaveLength(1));
  await act(() => hook.result.current.refetch());
  held.resolve();
  await act(() => creating);

  await waitFor(() =>
    expect(hook.result.current.invites.map((i) => i.id)).toEqual([3, 1, 2]),
  );
});

it("loads the whole list when an invite is created after a failed load", async () => {
  served.alsoServing({
    "GET /community/communityInvites/community/:communityId": () =>
      Response.json({ message: "Unavailable" }, { status: 503 }),
  });
  const { wrapper } = queryWrapper();
  const hook = renderHook(() => useCommunityInvites(7), { wrapper });
  await waitFor(() => expect(hook.result.current.didFail).toBe(true));
  served.alsoServing({});

  await act(() => hook.result.current.createInvite(9));

  await waitFor(() =>
    expect(hook.result.current.invites.map((i) => i.id)).toEqual([3, 1, 2]),
  );
});

it("keeps an invite whose delete the server refuses", async () => {
  respondToDelete = () =>
    Response.json({ message: "Forbidden" }, { status: 403 });
  const hook = await renderLoaded();

  await act(() =>
    expect(hook.result.current.deleteInvite(1)).rejects.toMatchObject({
      statusCode: 403,
    }),
  );

  expect(hook.result.current.invites).toEqual([invite(1), invite(2)]);
});

it("fails rather than reading a failed load as no invites", async () => {
  served.alsoServing({
    "GET /community/communityInvites/community/:communityId": () =>
      Response.json({ message: "Forbidden" }, { status: 403 }),
  });
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useCommunityInvites(7), { wrapper });

  await waitFor(() => expect(hook.result.current.didFail).toBe(true));
  expect(hook.result.current.invites).toEqual([]);
});

it("keeps loaded invites rather than failing when a refetch fails", async () => {
  const hook = await renderLoaded();
  served.alsoServing({
    "GET /community/communityInvites/community/:communityId": () =>
      Response.json({ message: "Forbidden" }, { status: 403 }),
  });

  await act(() => hook.result.current.refetch());

  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.didFail).toBe(false);
  expect(hook.result.current.invites).toEqual([invite(1), invite(2)]);
});
