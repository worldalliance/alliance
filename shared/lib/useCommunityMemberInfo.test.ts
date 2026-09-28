import { renderHook, waitFor } from "@testing-library/react";
import { milliseconds } from "date-fns";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useCommunityMemberInfo } from "./useCommunityMemberInfo";

let requests = 0;
let deadline: number | null = null;

serveApi(
  routes({
    "GET /actions/communityMemberInfo/4": () => {
      requests += 1;
      return Response.json({
        actions: [{ id: 1, memberActionDeadline: deadline }],
        users: [],
      });
    },
  }),
);

beforeEach(() => {
  requests = 0;
  deadline = null;
});

it("loads the member info of the given community", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(
    () => useCommunityMemberInfo({ communityId: 4, userId: 1 }),
    { wrapper },
  );

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(hook.result.current.data).toEqual({
    actions: [{ id: 1, memberActionDeadline: null }],
    users: [],
  });
});

it("does not fetch without a community id", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(
    () => useCommunityMemberInfo({ communityId: undefined, userId: 1 }),
    {
      wrapper,
    },
  );

  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(hook.result.current.data).toBeUndefined();
  expect(requests).toBe(0);
});

it("refetches once the next member-action deadline passes", async () => {
  deadline = Date.now() + 50;
  const { wrapper } = queryWrapper();

  renderHook(() => useCommunityMemberInfo({ communityId: 4, userId: 1 }), {
    wrapper,
  });

  await waitFor(() => expect(requests).toBe(1));
  await waitFor(() => expect(requests).toBe(2));
});

it("refetches on remount even when the client caches for longer", async () => {
  const { wrapper } = queryWrapper({ staleTime: milliseconds({ minutes: 5 }) });
  const first = renderHook(
    () => useCommunityMemberInfo({ communityId: 4, userId: 1 }),
    { wrapper },
  );
  await waitFor(() => expect(first.result.current.isSuccess).toBe(true));
  first.unmount();

  renderHook(() => useCommunityMemberInfo({ communityId: 4, userId: 1 }), {
    wrapper,
  });

  await waitFor(() => expect(requests).toBe(2));
});
