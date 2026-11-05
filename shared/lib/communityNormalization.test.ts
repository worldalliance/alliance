import { act, renderHook, waitFor } from "@testing-library/react";
import { communityStore, selectCommunity } from "./communityStore";
import { queryKeys } from "./queryKeys";
import { endSession } from "./sessionStores";
import { makeCommunity, makeProfile } from "./testFixtures";
import { pending, type Pending } from "./testing/pending";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { meCache } from "./useMe";
import { useMyCommunities } from "./useMyCommunities";
import { usePublicCommunities } from "./usePublicCommunities";

const leader = makeProfile(1);
const member = makeProfile(7);
const group = makeCommunity({ public: true, users: [leader, member] });

let mine: () => Promise<Response>;
let publics: () => Promise<Response>;
let write: () => Promise<Response>;
let held: Pending<Response>[];

serveApi(
  routes({
    "GET /community/list/my": () => mine(),
    "GET /community/list/public": () => publics(),
    "PATCH /community/1": () => write(),
    "POST /community/1/removeMember": () => write(),
    "POST /community/1/join": () => write(),
    "POST /community/1/leave": () => write(),
    "DELETE /community/1": () => write(),
    "POST /community/create": () => write(),
  }),
);

beforeEach(() => {
  mine = async () => Response.json([group]);
  publics = async () => Response.json([group]);
  write = async () => Response.json({});
  held = [];
});

const renderLists = () => {
  const query = queryWrapper();
  const hook = renderHook(
    () => ({ mine: useMyCommunities(), publics: usePublicCommunities() }),
    { wrapper: query.wrapper },
  );
  return { ...query, hook };
};

type Lists = ReturnType<typeof renderLists>["hook"];

const loaded = (hook: Lists) =>
  waitFor(() => {
    expect(hook.result.current.mine.communities).toHaveLength(1);
    expect(hook.result.current.publics.publicCommunities).toHaveLength(1);
  });

const shown = (hook: Lists) => [
  hook.result.current.mine.communities[0],
  hook.result.current.publics.publicCommunities[0],
];

it("shows saved settings in the user's groups and the public groups", async () => {
  const { hook } = renderLists();
  await loaded(hook);
  write = async () => Response.json({ ...group, name: "Renamed" });
  publics = () => new Promise(() => {});

  await act(() =>
    hook.result.current.mine.saveCommunity({
      communityId: 1,
      body: { name: "Renamed" },
    }),
  );

  await waitFor(() => {
    for (const community of shown(hook)) expect(community.name).toBe("Renamed");
  });
});

it("refetches the public groups after a save, which can make the group public or private", async () => {
  const { client, hook } = renderLists();
  await loaded(hook);
  write = async () => Response.json({ ...group, public: false });
  publics = () => pending(held);

  await act(() =>
    hook.result.current.mine.saveCommunity({
      communityId: 1,
      body: { public: false },
    }),
  );

  await waitFor(() => expect(held).toHaveLength(1));
  expect(client.getQueryState(queryKeys.publicCommunities())?.fetchStatus).toBe(
    "fetching",
  );
});

it("shows a removed member gone from the user's groups and the public groups", async () => {
  const { hook } = renderLists();
  await loaded(hook);
  write = async () => Response.json({ ...group, users: [leader] });

  await act(() =>
    hook.result.current.mine.removeMember({
      communityId: 1,
      memberId: member.id,
    }),
  );

  await waitFor(() => {
    for (const community of shown(hook))
      expect(community.users).toEqual([leader]);
  });
});

it("shows a joined group's new member in the public groups before its refetch lands", async () => {
  const joiner = makeProfile(9);
  const { hook } = renderLists();
  await loaded(hook);
  write = async () =>
    Response.json({ ...group, users: [leader, member, joiner] });
  mine = () => new Promise(() => {});
  publics = () => new Promise(() => {});

  void hook.result.current.mine.joinPublicCommunity(1);

  await waitFor(() =>
    expect(
      hook.result.current.publics.publicCommunities[0].users,
    ).toContainEqual(joiner),
  );
});

it("keeps the newer response when an older list load lands after it", async () => {
  publics = () => pending(held);
  const { hook } = renderLists();
  await waitFor(() => expect(held).toHaveLength(1));
  mine = async () => Response.json([{ ...group, name: "Newer" }]);
  await act(() => hook.result.current.mine.refetch());

  held[0].resolve(Response.json([{ ...group, name: "Older" }]));

  await loaded(hook);
  for (const community of shown(hook)) expect(community.name).toBe("Newer");
});

it("keeps saved settings over a list load that read the group before the save", async () => {
  const { hook } = renderLists();
  await loaded(hook);
  mine = () => pending(held);
  void hook.result.current.mine.refetch();
  await waitFor(() => expect(held).toHaveLength(1));
  write = async () => Response.json({ ...group, name: "Renamed" });
  publics = () => new Promise(() => {});

  await act(() =>
    hook.result.current.mine.saveCommunity({
      communityId: 1,
      body: { name: "Renamed" },
    }),
  );
  held[0].resolve(Response.json([group]));

  await waitFor(() => expect(hook.result.current.mine.isFetching).toBe(false));
  for (const community of shown(hook)) expect(community.name).toBe("Renamed");
});

it("drops a deleted group from the user's groups and the public groups", async () => {
  const { hook } = renderLists();
  await loaded(hook);
  write = async () => new Response(null);
  mine = () => new Promise(() => {});
  publics = () => new Promise(() => {});

  await act(() => hook.result.current.mine.deleteCommunity(1));

  await waitFor(() => {
    expect(hook.result.current.mine.communities).toEqual([]);
    expect(hook.result.current.publics.publicCommunities).toEqual([]);
  });
});

it("keeps a left group in the public groups", async () => {
  const { hook } = renderLists();
  await loaded(hook);
  write = async () => new Response(null);
  mine = () => new Promise(() => {});
  publics = () => new Promise(() => {});

  await act(() => hook.result.current.mine.leaveCommunity(1));

  await waitFor(() => expect(hook.result.current.mine.communities).toEqual([]));
  expect(hook.result.current.publics.publicCommunities).toEqual([group]);
});

it("keeps mounted lists rendering when the session ends", async () => {
  const { client, hook } = renderLists();
  await loaded(hook);

  act(() => meCache(client).clear());
  hook.rerender();

  expect(hook.result.current.mine.communities).toEqual([]);
  expect(hook.result.current.publics.publicCommunities).toEqual([]);
});

it("does not patch the next session with settings saved after a sign-in change", async () => {
  const { client, hook } = renderLists();
  await loaded(hook);
  const answer = Promise.withResolvers<Response>();
  write = () => answer.promise;

  const saved = hook.result.current.mine.saveCommunity({
    communityId: 1,
    body: { name: "Renamed" },
  });
  await waitFor(() => expect(client.isMutating()).toBe(1));
  mine = () => new Promise(() => {});
  publics = () => new Promise(() => {});
  act(() => endSession(client));
  await act(() =>
    communityStore(client).load({
      signal: new AbortController().signal,
      fetch: async () => [{ ...group, name: "Next viewer's copy" }],
    }),
  );
  answer.resolve(Response.json({ ...group, name: "Renamed" }));
  await act(() => saved);

  expect(selectCommunity(communityStore(client).getState(), 1).name).toBe(
    "Next viewer's copy",
  );
});

const newGroup = makeCommunity({ id: 2, name: "New group" });

it.each([
  {
    write: "create",
    send: (lists: Lists) =>
      lists.result.current.mine.createCommunity({
        name: newGroup.name,
        description: newGroup.description,
        public: false,
        allowMemberInvites: true,
        allowStaffAssignments: true,
        maxCapacity: null,
      }),
    answer: () => Response.json(newGroup),
  },
  {
    write: "leave",
    send: (lists: Lists) => lists.result.current.mine.leaveCommunity(1),
    answer: () => new Response(null),
  },
  {
    write: "delete",
    send: (lists: Lists) => lists.result.current.mine.deleteCommunity(1),
    answer: () => new Response(null),
  },
])(
  "does not change the next session's lists with a $write answered after a sign-in change",
  async ({ send, answer }) => {
    const { client, hook } = renderLists();
    await loaded(hook);
    const response = Promise.withResolvers<Response>();
    write = () => response.promise;

    const sent = send(hook);
    await waitFor(() => expect(client.isMutating()).toBe(1));
    act(() => meCache(client).clear());
    hook.rerender();
    await act(() =>
      Promise.all([
        hook.result.current.mine.refetch(),
        hook.result.current.publics.refetch(),
      ]),
    );
    mine = () => new Promise(() => {});
    publics = () => new Promise(() => {});
    response.resolve(answer());
    await act(async () => {
      await sent;
    });
    hook.unmount();

    expect(client.getQueryData(queryKeys.myCommunities())).toEqual([1]);
    expect(client.getQueryData(queryKeys.publicCommunities())).toEqual([1]);
  },
);
