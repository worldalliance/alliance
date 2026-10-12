import { act, renderHook, waitFor } from "@testing-library/react";
import { queryKeys } from "./queryKeys";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useIncomingCommunityInvites } from "./useIncomingCommunityInvites";

const invite = (id: number, status: string) => ({
  id,
  status,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  community: { id: id * 10, name: `Group ${id}` },
});

let requests: string[] = [];
let listResponse: () => Response | Promise<Response>;
let acceptResponse: () => Response;
let rejectResponse: () => Response;

serveApi(
  routes({
    "GET /community/communityInvites": () => {
      requests.push("list");
      return listResponse();
    },
    "POST /community/communityInvites/1/accept": () => {
      requests.push("accept");
      return acceptResponse();
    },
    "POST /community/communityInvites/1/reject": () => {
      requests.push("reject");
      return rejectResponse();
    },
  }),
);

const listed = [invite(1, "invitee_pending"), invite(2, "invitee_accepted")];

beforeEach(() => {
  requests = [];
  listResponse = () => Response.json(listed);
  acceptResponse = () => Response.json({});
  rejectResponse = () => Response.json({});
});

const renderLoaded = async () => {
  const query = queryWrapper();
  query.client.setQueryData(queryKeys.myCommunities(), []);
  query.client.setQueryData(queryKeys.publicCommunities(), []);
  const hook = renderHook(() => useIncomingCommunityInvites(), {
    wrapper: query.wrapper,
  });
  await waitFor(() =>
    expect(hook.result.current.incomingCommunityInvitesById.size).toBe(2),
  );
  const invalidated = (queryKey: readonly unknown[]) =>
    query.client.getQueryState(queryKey)?.isInvalidated;
  return { hook, client: query.client, invalidated };
};

it("lists only the pending invites as pending", async () => {
  const { hook } = await renderLoaded();

  expect(hook.result.current.pendingCommunityInvites).toEqual([listed[0]]);
  expect(hook.result.current.incomingCommunityInvitesById.get(2)).toEqual(
    listed[1],
  );
});

it("reports a failed load", async () => {
  listResponse = () => Response.json({}, { status: 500 });
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useIncomingCommunityInvites(), { wrapper });

  await waitFor(() => expect(hook.result.current.didFail).toBe(true));
  expect(hook.result.current.pendingCommunityInvites).toEqual([]);
});

it("marks an accepted invite and refreshes the groups it changes", async () => {
  const { hook, invalidated } = await renderLoaded();

  await act(() => hook.result.current.acceptCommunityInvite(1));

  await waitFor(() =>
    expect(hook.result.current.pendingCommunityInvites).toEqual([]),
  );
  expect(hook.result.current.incomingCommunityInvitesById.get(1)?.status).toBe(
    "invitee_accepted",
  );
  expect(invalidated(queryKeys.myCommunities())).toBe(true);
  expect(invalidated(queryKeys.publicCommunities())).toBe(true);
  expect(requests).toEqual(["list", "accept"]);
});

it("marks a declined invite without refreshing any groups", async () => {
  const { hook, invalidated } = await renderLoaded();

  await act(() => hook.result.current.declineCommunityInvite(1));

  await waitFor(() =>
    expect(hook.result.current.pendingCommunityInvites).toEqual([]),
  );
  expect(hook.result.current.incomingCommunityInvitesById.get(1)?.status).toBe(
    "invitee_rejected",
  );
  expect(invalidated(queryKeys.myCommunities())).toBe(false);
  expect(invalidated(queryKeys.publicCommunities())).toBe(false);
});

it.each([
  {
    write: "acceptCommunityInvite",
    setRefusal: () => (acceptResponse = refused),
  },
  {
    write: "declineCommunityInvite",
    setRefusal: () => (rejectResponse = refused),
  },
] as const)(
  "throws and keeps the invite pending when $write is refused",
  async ({ write, setRefusal }) => {
    setRefusal();
    const { hook, invalidated } = await renderLoaded();

    const failure = hook.result.current[write](1).catch((e: unknown) => e);

    expect(await failure).toMatchObject({ statusCode: 400 });
    await waitFor(() =>
      expect(hook.result.current.pendingCommunityInvites).toEqual([listed[0]]),
    );
    expect(invalidated(queryKeys.myCommunities())).toBe(false);
  },
);

it("keeps an answered invite over a reload that read it before", async () => {
  const { hook, client } = await renderLoaded();
  const reload = Promise.withResolvers<Response>();
  listResponse = () => reload.promise;
  void client.refetchQueries({
    queryKey: queryKeys.incomingCommunityInvites(),
  });
  await waitFor(() => expect(requests).toEqual(["list", "list"]));

  void hook.result.current.declineCommunityInvite(1);
  await waitFor(() =>
    expect(hook.result.current.pendingCommunityInvites).toEqual([]),
  );
  reload.resolve(Response.json(listed));

  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(hook.result.current.pendingCommunityInvites).toEqual([]);
});

function refused() {
  return Response.json({ statusCode: 400 }, { status: 400 });
}
