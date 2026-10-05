import { makeCommunity } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useCommunitiesAdmin } from "./useCommunitiesAdmin";

afterEach(cleanup);

const communities = [makeCommunity({ id: 4, name: "North" })];

serveApi(
  routes({
    "GET /community/list": () => Response.json(communities),
  }),
);

describe("useCommunitiesAdmin", () => {
  it("reads every community", async () => {
    const view = renderHook(() => useCommunitiesAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.data).toEqual(communities));
  });
});
