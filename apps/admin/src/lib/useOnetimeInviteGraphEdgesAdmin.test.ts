import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { renderHook, waitFor } from "@testing-library/react";
import { useOnetimeInviteGraphEdgesAdmin } from "./useOnetimeInviteGraphEdgesAdmin";

const edges = [{ invitingUserId: 1, invitedUserId: 2 }];

let respond: () => Response;

serveApi(
  routes({
    "GET /user/onetimeInvites/graphEdges": () => respond(),
  }),
);

beforeEach(() => {
  respond = () => Response.json(edges);
});

describe("useOnetimeInviteGraphEdgesAdmin", () => {
  it("reads every used invite", async () => {
    const view = renderHook(
      () => useOnetimeInviteGraphEdgesAdmin(),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.data).toEqual(edges));
  });

  it("surfaces a refused load as an error carrying its status", async () => {
    respond = () => Response.json({ message: "Forbidden" }, { status: 403 });

    const view = renderHook(
      () => useOnetimeInviteGraphEdgesAdmin(),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.error).toMatchObject({ statusCode: 403 });
  });
});
