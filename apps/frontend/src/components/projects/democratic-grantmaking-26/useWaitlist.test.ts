import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useWaitlistBrowser } from "./useWaitlist";

let browserLoads = 0;

serveApi(
  routes({
    "GET /waitlist/browser": () => {
      browserLoads += 1;
      return Response.json({ entry: null });
    },
    "POST /waitlist/entries": () => Response.json({ shareCode: "abc123" }),
  }),
);

test("joining reloads the remembered entry and the waitlist count", async () => {
  const { client, wrapper } = queryWrapper();
  client.setQueryData(queryKeys.waitlistCount(), 41);
  const hook = renderHook(() => useWaitlistBrowser(), { wrapper });
  await waitFor(() => expect(browserLoads).toBe(1));

  await act(() =>
    hook.result.current.join.mutateAsync({
      name: "Test Person",
      email: "person@example.com",
    }),
  );

  expect(client.getQueryState(queryKeys.waitlistCount())?.isInvalidated).toBe(
    true,
  );
  await waitFor(() => expect(browserLoads).toBe(2));
});
