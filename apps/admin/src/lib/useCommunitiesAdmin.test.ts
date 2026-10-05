import { makeCommunity } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  useAssignGroupsAdmin,
  useCommunitiesAdmin,
} from "./useCommunitiesAdmin";

afterEach(cleanup);

const north = makeCommunity({ id: 4, name: "North" });

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
  }),
);

afterEach(() => {
  assignStatus = 200;
  listCalls = 0;
});

describe("useCommunitiesAdmin", () => {
  it("reads every community", async () => {
    const view = renderHook(() => useCommunitiesAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.data).toEqual([north]));
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
