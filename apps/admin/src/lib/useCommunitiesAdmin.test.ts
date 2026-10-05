import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { makeCommunity } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  useAssignGroupsAdmin,
  useCommunitiesAdmin,
  useCreateCommunityAdmin,
} from "./useCommunitiesAdmin";

afterEach(cleanup);

const north = makeCommunity({ id: 4, name: "North" });
const south = makeCommunity({ id: 5, name: "South" });

let createStatus = 200;
let assignStatus = 200;
let listCalls = 0;

serveApi(
  routes({
    "GET /community/list": () => {
      listCalls += 1;
      return Response.json([north]);
    },
    "POST /user/groupAssignment/assign": () =>
      Response.json({}, { status: assignStatus }),
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
