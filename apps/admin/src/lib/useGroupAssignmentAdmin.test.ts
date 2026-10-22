import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { makeCommunity, makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { renderHook, waitFor } from "@testing-library/react";
import { useCommunitiesAdmin } from "./useCommunitiesAdmin";
import {
  useAssignGroupsAdmin,
  useGroupAssignmentMembersAdmin,
} from "./useGroupAssignmentAdmin";

const sam = makeUser({ id: 7, name: "Sam" });
const kim = makeUser({ id: 8, name: "Kim" });

let assignStatus = 200;
let listCalls = 0;
let queueCalls = 0;

serveApi(
  routes({
    "GET /community/list": () => {
      listCalls += 1;
      return Response.json([makeCommunity({ id: 4, name: "North" })]);
    },
    "POST /user/groupAssignment/members": () => {
      queueCalls += 1;
      return Response.json([sam, kim]);
    },
    "POST /user/groupAssignment/assign": () =>
      Response.json({}, { status: assignStatus }),
  }),
);

afterEach(() => {
  assignStatus = 200;
  listCalls = 0;
  queueCalls = 0;
});

describe("useGroupAssignmentMembersAdmin", () => {
  it("reads the members awaiting assignment", async () => {
    const view = renderHook(
      () => useGroupAssignmentMembersAdmin(),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.data).toEqual([sam, kim]));
  });
});

describe("useAssignGroupsAdmin", () => {
  const assign = async () => {
    const query = queryWrapper();
    const view = renderHook(
      () => ({
        communities: useCommunitiesAdmin(),
        members: useGroupAssignmentMembersAdmin(),
        assign: useAssignGroupsAdmin(),
      }),
      query,
    );
    await waitFor(() => {
      expect(view.result.current.communities.data).toBeTruthy();
      expect(view.result.current.members.data).toBeTruthy();
    });
    const cachedMembers = () =>
      query.client.getQueryData(queryKeys.groupAssignmentMembersAdmin());
    const result = view.result.current.assign.mutateAsync({
      assignments: [{ userId: 7, communityId: 4 }],
    });
    return { result, cachedMembers };
  };

  it("drops the assigned members from the queue and refetches the communities", async () => {
    const { result, cachedMembers } = await assign();
    await result;

    expect(cachedMembers()).toEqual([kim]);
    await waitFor(() => expect(listCalls).toBe(2));
    expect(queueCalls).toBe(1);
  });

  it("refetches the queue and the communities after a failed assignment", async () => {
    assignStatus = 400;
    const { result } = await assign();

    await expect(result).rejects.toBeTruthy();

    await waitFor(() => {
      expect(listCalls).toBe(2);
      expect(queueCalls).toBe(2);
    });
  });
});
