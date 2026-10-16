import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useFriendGraphEdgesAdmin } from "./useFriendGraphEdgesAdmin";

afterEach(cleanup);

const edges = [{ userAId: 1, userBId: 2 }];

let respond: () => Response;

serveApi(
  routes({
    "GET /user/friends/graphEdges": () => respond(),
  }),
);

beforeEach(() => {
  respond = () => Response.json(edges);
});

describe("useFriendGraphEdgesAdmin", () => {
  it("reads every friendship", async () => {
    const view = renderHook(() => useFriendGraphEdgesAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.data).toEqual(edges));
  });

  it("surfaces a refused load as an error carrying its status", async () => {
    respond = () => Response.json({ message: "Forbidden" }, { status: 403 });

    const view = renderHook(() => useFriendGraphEdgesAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.error).toMatchObject({ statusCode: 403 });
  });
});
