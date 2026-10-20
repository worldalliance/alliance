import { act, renderHook, waitFor } from "@testing-library/react";
import { makeOnetimeInvite } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useCommunityOnetimeInvites } from "./useCommunityOnetimeInvites";

const invites = [makeOnetimeInvite({ id: 1 }), makeOnetimeInvite({ id: 2 })];
let requested: string[] = [];
let holdingLoads: Promise<void> | null;

const served = serveApi(
  routes({
    "GET /user/onetimeInvites/:communityId": ({ params }) => {
      requested.push(params.communityId);
      return (holdingLoads ?? Promise.resolve()).then(() =>
        Response.json(invites),
      );
    },
  }),
);

beforeEach(() => {
  requested = [];
  holdingLoads = null;
});

const failLoads = () =>
  served.alsoServing({
    "GET /user/onetimeInvites/:communityId": () =>
      Response.json({ message: "Forbidden" }, { status: 403 }),
  });

it("loads a community's one-time invites", async () => {
  const { wrapper } = queryWrapper();
  const hook = renderHook(() => useCommunityOnetimeInvites(7), { wrapper });

  await waitFor(() => expect(hook.result.current.invites).toEqual(invites));
  expect(requested).toEqual(["7"]);
  expect(hook.result.current.didFail).toBe(false);
});

it("fails rather than reading a failed load as no invites, through the retry that loads them", async () => {
  failLoads();
  const { wrapper } = queryWrapper();
  const hook = renderHook(() => useCommunityOnetimeInvites(7), { wrapper });
  await waitFor(() => expect(hook.result.current.didFail).toBe(true));
  expect(hook.result.current.invites).toEqual([]);
  served.alsoServing({});
  const held = Promise.withResolvers<void>();
  holdingLoads = held.promise;

  void hook.result.current.refetch();
  await waitFor(() => expect(hook.result.current.isFetching).toBe(true));
  expect(hook.result.current.didFail).toBe(true);
  held.resolve();

  await waitFor(() => expect(hook.result.current.invites).toEqual(invites));
  expect(hook.result.current.didFail).toBe(false);
});

it("keeps loaded invites rather than failing when a refetch fails", async () => {
  const { wrapper } = queryWrapper();
  const hook = renderHook(() => useCommunityOnetimeInvites(7), { wrapper });
  await waitFor(() => expect(hook.result.current.invites).toEqual(invites));
  failLoads();

  await act(() => hook.result.current.refetch());

  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.didFail).toBe(false);
  expect(hook.result.current.invites).toEqual(invites);
});
