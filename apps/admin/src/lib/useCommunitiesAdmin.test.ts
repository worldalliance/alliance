import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { makeCommunity, makeProfile } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  MembershipChange,
  useAssignGroupsAdmin,
  useChangeCommunityMembershipAdmin,
  useCommunitiesAdmin,
  useCreateCommunityAdmin,
  useDeleteCommunityAdmin,
  useUpdateCommunityAdmin,
} from "./useCommunitiesAdmin";

afterEach(cleanup);

const north = makeCommunity({ id: 4, name: "North" });
const south = makeCommunity({ id: 5, name: "South" });

let createStatus = 200;
let assignStatus = 200;
let listCalls = 0;
const changes: string[] = [];

serveApi(
  routes({
    "GET /community/list": () => {
      listCalls += 1;
      return Response.json([north]);
    },
    "POST /user/groupAssignment/assign": () =>
      Response.json({}, { status: assignStatus }),
    "PATCH /community/:communityId": async ({ request }) =>
      Response.json({ ...north, ...(await request.json()) }),
    "POST /community/:communityId/:change/admin": async ({
      request,
      params,
    }) => {
      const { userId }: { userId: number } = await request.json();
      changes.push(params.change);
      return params.change !== "removeLeader"
        ? Response.json({ ...north, users: [makeProfile(userId)] })
        : Response.json({ message: "Not allowed" }, { status: 400 });
    },
    "DELETE /community/:communityId/admin": () => Response.json({}),
    "POST /community/create/admin": () =>
      createStatus === 200
        ? Response.json(south)
        : Response.json({}, { status: createStatus }),
  }),
);

afterEach(() => {
  createStatus = 200;
  assignStatus = 200;
  listCalls = 0;
  changes.length = 0;
});

describe("useCommunitiesAdmin", () => {
  it("reads every community", async () => {
    const view = renderHook(() => useCommunitiesAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.data).toEqual([north]));
  });
});

describe("useCreateCommunityAdmin", () => {
  const body = {
    name: "South",
    description: "A group",
    public: false,
    allowMemberInvites: true,
    allowStaffAssignments: true,
    maxCapacity: 10,
  };

  it("adds the created community to the list", async () => {
    const query = queryWrapper();
    const onSuccess = jest.fn();
    const view = renderHook(
      () => ({
        communities: useCommunitiesAdmin(),
        create: useCreateCommunityAdmin({ onSuccess, onError: () => {} }),
      }),
      query,
    );
    await waitFor(() =>
      expect(view.result.current.communities.data).toBeTruthy(),
    );

    view.result.current.create.mutate(body);

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(query.client.getQueryData(queryKeys.communitiesAdmin())).toEqual([
      north,
      south,
    ]);
  });

  it("lists a created community once when a refetch already has it", async () => {
    const query = queryWrapper();
    query.client.setQueryData(queryKeys.communitiesAdmin(), [north, south]);
    const onSuccess = jest.fn();
    const view = renderHook(
      () => useCreateCommunityAdmin({ onSuccess, onError: () => {} }),
      query,
    );

    view.result.current.mutate(body);

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(query.client.getQueryData(queryKeys.communitiesAdmin())).toEqual([
      north,
      south,
    ]);
  });

  it("reports a refused create", async () => {
    createStatus = 400;
    const onError = jest.fn();
    const view = renderHook(
      () => useCreateCommunityAdmin({ onSuccess: () => {}, onError }),
      queryWrapper(),
    );

    view.result.current.mutate(body);

    await waitFor(() => expect(onError).toHaveBeenCalled());
  });
});

describe("useAssignGroupsAdmin", () => {
  const assign = async () => {
    const view = renderHook(
      () => ({
        communities: useCommunitiesAdmin(),
        assign: useAssignGroupsAdmin(),
      }),
      queryWrapper(),
    );
    await waitFor(() =>
      expect(view.result.current.communities.data).toBeTruthy(),
    );
    return view.result.current.assign.mutateAsync({
      assignments: [{ userId: 7, communityId: 4 }],
    });
  };

  it("refetches the communities after an assignment", async () => {
    await assign();

    await waitFor(() => expect(listCalls).toBe(2));
  });

  it("refetches the communities after a refused assignment", async () => {
    assignStatus = 400;

    await expect(assign()).rejects.toBeTruthy();

    await waitFor(() => expect(listCalls).toBe(2));
  });
});

const renderWithList = async <T>(useMutationHook: () => T) => {
  const query = queryWrapper();
  const view = renderHook(
    () => ({ communities: useCommunitiesAdmin(), mutation: useMutationHook() }),
    query,
  );
  await waitFor(() =>
    expect(view.result.current.communities.data).toBeTruthy(),
  );
  const cached = () => query.client.getQueryData(queryKeys.communitiesAdmin());
  return { mutation: () => view.result.current.mutation, cached };
};

describe("useUpdateCommunityAdmin", () => {
  it("puts the updated community in the list", async () => {
    const onSuccess = jest.fn();
    const { mutation, cached } = await renderWithList(() =>
      useUpdateCommunityAdmin({ onSuccess, onError: () => {} }),
    );

    mutation().mutate({ communityId: 4, body: { name: "Northwest" } });

    const updated = { ...north, name: "Northwest" };
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(updated));
    expect(cached()).toEqual([updated]);
  });
});

describe("useChangeCommunityMembershipAdmin", () => {
  it("puts the changed community in the list", async () => {
    const { mutation, cached } = await renderWithList(() =>
      useChangeCommunityMembershipAdmin(),
    );

    await mutation().mutateAsync({
      communityId: 4,
      userId: 7,
      change: MembershipChange.AddMember,
    });

    expect(cached()).toEqual([{ ...north, users: [makeProfile(7)] }]);
  });

  it("sends each change to its own endpoint", async () => {
    const { mutation } = await renderWithList(() =>
      useChangeCommunityMembershipAdmin(),
    );

    for (const change of [
      MembershipChange.AddMember,
      MembershipChange.RemoveMember,
      MembershipChange.AddLeader,
    ]) {
      await mutation().mutateAsync({ communityId: 4, userId: 7, change });
    }

    expect(changes).toEqual(["addMember", "removeMember", "addLeader"]);
  });

  it("leaves the list alone when the change is refused", async () => {
    const { mutation, cached } = await renderWithList(() =>
      useChangeCommunityMembershipAdmin(),
    );

    await expect(
      mutation().mutateAsync({
        communityId: 4,
        userId: 7,
        change: MembershipChange.RemoveLeader,
      }),
    ).rejects.toBeTruthy();

    expect(changes).toEqual(["removeLeader"]);
    expect(cached()).toEqual([north]);
  });
});

describe("useDeleteCommunityAdmin", () => {
  it("drops the deleted community from the list", async () => {
    const onSuccess = jest.fn();
    const { mutation, cached } = await renderWithList(() =>
      useDeleteCommunityAdmin({ onSuccess, onError: () => {} }),
    );

    mutation().mutate(4);

    await waitFor(() => expect(cached()).toEqual([]));
    expect(onSuccess).toHaveBeenCalled();
  });
});
