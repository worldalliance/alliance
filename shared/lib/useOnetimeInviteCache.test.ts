import { act, renderHook, waitFor } from "@testing-library/react";
import { z } from "zod";
import type { OnetimeInviteDto } from "../client/types.gen";
import { queryKeys } from "./queryKeys";
import { makeCommunity, makeOnetimeInvite } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useCommunityOnetimeInvites } from "./useCommunityOnetimeInvites";
import { useOnetimeInvitesOverview } from "./useOnetimeInvitesOverview";

let serverInvites: OnetimeInviteDto[];
let listReads: string[];
let holdingOverview: Promise<void> | null;
let holdingGroupList: Promise<void> | null;

serveApi(
  routes({
    "GET /user/onetimeInvites/overview": async () => {
      listReads.push("overview");
      const read = [...serverInvites];
      await holdingOverview;
      return Response.json(read);
    },
    "GET /user/onetimeInvites/:communityId": async ({ params }) => {
      listReads.push(`community ${params.communityId}`);
      const read = [...serverInvites];
      await holdingGroupList;
      return Response.json(read);
    },
    "POST /user/onetimeInvite/create": () => {
      const invite = makeOnetimeInvite({ id: 2 });
      serverInvites = [invite, ...serverInvites];
      return Response.json(invite);
    },
    "POST /user/onetimeInvite/:inviteId/reject": ({ params }) => {
      serverInvites = serverInvites.map((invite) =>
        invite.id === Number(params.inviteId)
          ? { ...invite, status: "request_rejected" }
          : invite,
      );
      return new Response(null, { status: 200 });
    },
    "DELETE /user/onetimeInvites/:inviteId": ({ params }) => {
      serverInvites = serverInvites.filter(
        (invite) => invite.id !== Number(params.inviteId),
      );
      return new Response(null, { status: 200 });
    },
    "PATCH /user/onetimeInvites/:inviteId": async ({ params, request }) => {
      const body = z
        .object({
          invitee: z.string().optional(),
          communityId: z.number().nullable().optional(),
        })
        .parse(await request.json());
      const id = Number(params.inviteId);
      serverInvites = serverInvites.map((invite) => {
        if (invite.id !== id) return invite;
        return {
          ...invite,
          invitee: body.invitee ?? invite.invitee,
          community:
            body.communityId === undefined
              ? invite.community
              : body.communityId === null
                ? null
                : makeCommunity({ id: body.communityId }),
        };
      });
      return Response.json(serverInvites.find((invite) => invite.id === id));
    },
    "POST /user/onetimeInvite/:inviteId/approve": ({ params }) => {
      serverInvites = serverInvites.map((invite) =>
        invite.id === Number(params.inviteId)
          ? { ...invite, status: "link_unused" }
          : invite,
      );
      const approved = serverInvites.find(
        (invite) => invite.id === Number(params.inviteId),
      );
      if (!approved) return new Response(null, { status: 404 });
      const { community: _community, ...withoutCommunity } = approved;
      return Response.json(withoutCommunity);
    },
  }),
);

beforeEach(() => {
  serverInvites = [
    makeOnetimeInvite({
      id: 1,
      status: "request_pending",
      community: makeCommunity({ id: 7 }),
    }),
  ];
  listReads = [];
  holdingOverview = null;
  holdingGroupList = null;
});

const renderBoth = async () => {
  const { wrapper } = queryWrapper({ staleTime: Infinity });
  const hook = renderHook(
    () => ({
      group: useCommunityOnetimeInvites(7),
      overview: useOnetimeInvitesOverview(),
    }),
    { wrapper },
  );
  await waitFor(() => {
    expect(hook.result.current.group.invites).toHaveLength(1);
    expect(hook.result.current.overview.invites).toHaveLength(1);
  });
  listReads = [];
  return hook;
};

it("refetches the overview after approving from a group's list", async () => {
  const hook = await renderBoth();

  await act(async () => {
    await hook.result.current.group.approveInvite(1);
  });

  await waitFor(() =>
    expect(hook.result.current.overview.invites[0].status).toBe("link_unused"),
  );
  expect(listReads).toEqual(["overview"]);
});

it("refetches the overview after rejecting from a group's list", async () => {
  const hook = await renderBoth();

  await act(async () => {
    await hook.result.current.group.rejectInvite(1);
  });

  await waitFor(() =>
    expect(hook.result.current.overview.invites[0].status).toBe(
      "request_rejected",
    ),
  );
  expect(listReads).toEqual(["overview"]);
});

it("refetches the overview after deleting from a group's list", async () => {
  const hook = await renderBoth();

  await act(async () => {
    await hook.result.current.group.deleteInvite(1);
  });

  await waitFor(() => expect(hook.result.current.overview.invites).toEqual([]));
  expect(listReads).toEqual(["overview"]);
});

it("refetches the overview after creating from a group's list", async () => {
  const hook = await renderBoth();

  await act(async () => {
    await hook.result.current.group.createInvite({
      invitee: "Sam",
      communityId: 7,
    });
  });

  await waitFor(() =>
    expect(hook.result.current.overview.invites.map((i) => i.id)).toEqual([
      2, 1,
    ]),
  );
  expect(listReads).toEqual(["overview"]);
});

it("refetches a group's list after approving from the overview", async () => {
  const hook = await renderBoth();

  await act(async () => {
    await hook.result.current.overview.approveInvite(1);
  });

  await waitFor(() =>
    expect(hook.result.current.group.invites[0].status).toBe("link_unused"),
  );
  expect(listReads).toEqual(["community 7"]);
});

it("refetches a group's list after editing from the overview", async () => {
  const hook = await renderBoth();

  await act(async () => {
    await hook.result.current.overview.updateInvite({
      inviteId: 1,
      invitee: "Ada",
    });
  });

  await waitFor(() =>
    expect(hook.result.current.group.invites[0].invitee).toBe("Ada"),
  );
  expect(listReads).toEqual(["community 7"]);
});

describe("after moving to the overview from a group's list", () => {
  const visitGroupThenOverview = async (
    mutate: (group: ReturnType<typeof useCommunityOnetimeInvites>) => unknown,
  ) => {
    const { wrapper } = queryWrapper();
    const overview = renderHook(() => useOnetimeInvitesOverview(), {
      wrapper,
    });
    await waitFor(() =>
      expect(overview.result.current.invites).toHaveLength(1),
    );
    overview.unmount();

    const group = renderHook(() => useCommunityOnetimeInvites(7), { wrapper });
    await waitFor(() => expect(group.result.current.invites).toHaveLength(1));
    await act(async () => {
      await mutate(group.result.current);
    });
    group.unmount();

    holdingOverview = new Promise(() => {});
    return renderHook(() => useOnetimeInvitesOverview(), { wrapper }).result
      .current.invites;
  };

  it("shows an approved request as a link before refetching", async () => {
    const firstRender = await visitGroupThenOverview((group) =>
      group.approveInvite(1),
    );

    expect(firstRender).toMatchObject([
      { status: "link_unused", community: { id: 7 } },
    ]);
  });

  it("shows a rejected request as rejected before refetching", async () => {
    const firstRender = await visitGroupThenOverview((group) =>
      group.rejectInvite(1),
    );

    expect(firstRender.map((invite) => invite.status)).toEqual([
      "request_rejected",
    ]);
  });

  it("drops a deleted invite before refetching", async () => {
    const firstRender = await visitGroupThenOverview((group) =>
      group.deleteInvite(1),
    );

    expect(firstRender).toEqual([]);
  });
});

it.each([9, null])(
  "drops an invite moved to group %p from the group it left",
  async (communityId) => {
    const { wrapper } = queryWrapper();
    const group = renderHook(() => useCommunityOnetimeInvites(7), { wrapper });
    await waitFor(() => expect(group.result.current.invites).toHaveLength(1));
    group.unmount();

    const overview = renderHook(() => useOnetimeInvitesOverview(), { wrapper });
    await waitFor(() =>
      expect(overview.result.current.invites).toHaveLength(1),
    );
    await act(async () => {
      await overview.result.current.updateInvite({ inviteId: 1, communityId });
    });
    overview.unmount();

    holdingGroupList = new Promise(() => {});
    expect(
      renderHook(() => useCommunityOnetimeInvites(7), { wrapper }).result
        .current.invites,
    ).toEqual([]);
  },
);

it("keeps a rejected request in the list it was rejected from", async () => {
  const hook = await renderBoth();

  await act(async () => {
    await hook.result.current.group.rejectInvite(1);
  });

  await waitFor(() =>
    expect(hook.result.current.group.invites).toMatchObject([
      { id: 1, status: "request_rejected" },
    ]),
  );
});

it("keeps an approved invite in its group while another list changes", async () => {
  serverInvites = [
    ...serverInvites,
    makeOnetimeInvite({
      id: 3,
      status: "request_pending",
      community: makeCommunity({ id: 7 }),
    }),
  ];
  const { client, wrapper } = queryWrapper();
  const hook = renderHook(
    () => ({
      group: useCommunityOnetimeInvites(7),
      overview: useOnetimeInvitesOverview(),
    }),
    { wrapper },
  );
  await waitFor(() => {
    expect(hook.result.current.group.invites).toHaveLength(2);
    expect(hook.result.current.overview.invites).toHaveLength(2);
  });

  holdingGroupList = new Promise(() => {});
  await act(async () => {
    await hook.result.current.group.approveInvite(1);
    await hook.result.current.overview.rejectInvite(3);
  });

  expect(
    client
      .getQueryData<OnetimeInviteDto[]>(queryKeys.communityOnetimeInvites(7))
      ?.map((invite) => invite.id),
  ).toEqual([1, 3]);
  hook.unmount();
});

describe("with two groups' lists cached", () => {
  const renderThree = async () => {
    const { wrapper } = queryWrapper({ staleTime: Infinity });
    const hook = renderHook(
      () => ({
        overview: useOnetimeInvitesOverview(),
        group: useCommunityOnetimeInvites(7),
        otherGroup: useCommunityOnetimeInvites(8),
      }),
      { wrapper },
    );
    await waitFor(() => expect(listReads).toHaveLength(3));
    listReads = [];
    return hook;
  };

  it("refetches every group's invites, but not the overview it wrote, after an overview write", async () => {
    const hook = await renderThree();

    await act(() =>
      hook.result.current.overview.createInvite({
        invitee: "Ada",
        communityId: 7,
      }),
    );

    await waitFor(() =>
      expect([...listReads].sort()).toEqual(["community 7", "community 8"]),
    );
    expect(hook.result.current.overview.invites.map((i) => i.id)).toEqual([
      2, 1,
    ]);
  });

  it.each(["approveInvite", "rejectInvite"] as const)(
    "refetches the overview and other groups, but not the group it wrote, after %s",
    async (mutation) => {
      const hook = await renderThree();

      await act(async () => {
        await hook.result.current.group[mutation](1);
      });

      await waitFor(() =>
        expect([...listReads].sort()).toEqual(["community 8", "overview"]),
      );
    },
  );
});
