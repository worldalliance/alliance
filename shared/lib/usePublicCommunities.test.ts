import { renderHook, waitFor } from "@testing-library/react";
import { retryUnlessRefused } from "./retryQuery";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { usePublicCommunities } from "./usePublicCommunities";

let requests = 0;

serveApi(
  routes({
    "GET /community/list/public": async () => {
      requests++;
      return Response.json(
        { message: "Not found", statusCode: 404 },
        { status: 404 },
      );
    },
  }),
);

it("does not retry a refused public groups load", async () => {
  const { wrapper } = queryWrapper({
    retry: retryUnlessRefused(3),
    retryDelay: 0,
  });

  const hook = renderHook(() => usePublicCommunities(), { wrapper });

  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(requests).toBe(1);
});
