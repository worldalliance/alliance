import { renderHook, waitFor } from "@testing-library/react";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useCommunityCompletedActionsCount } from "./useCommunityCompletedActionsCount";

let requested: (string | null)[] = [];
let respond: () => Response;

serveApi(
  routes({
    "GET /actions/communityCompletedActionsCount": ({ request }) => {
      requested.push(new URL(request.url).searchParams.get("communityId"));
      return respond();
    },
  }),
);

beforeEach(() => {
  requested = [];
  respond = () => Response.json({ completedCount: 5 });
});

it("loads the community's completed actions count", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(
    () => useCommunityCompletedActionsCount({ communityId: 4, actions: [] }),
    { wrapper },
  );

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(hook.result.current.data).toBe(5);
  expect(requested).toEqual(["4"]);
});

it("requests nothing without a community id", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(
    () =>
      useCommunityCompletedActionsCount({
        communityId: undefined,
        actions: [],
      }),
    { wrapper },
  );

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(hook.result.current.fetchStatus).toBe("idle");
  expect(requested).toEqual([]);
});

it("refetches once the next member-action deadline passes", async () => {
  const actions = [{ memberActionDeadline: Date.now() + 50 }];
  const { wrapper } = queryWrapper();

  renderHook(
    () => useCommunityCompletedActionsCount({ communityId: 4, actions }),
    { wrapper },
  );

  await waitFor(() => expect(requested).toEqual(["4"]));
  await waitFor(() => expect(requested).toEqual(["4", "4"]));
});

it("fails rather than reading a failed load as zero", async () => {
  respond = () => Response.json({ message: "Forbidden" }, { status: 403 });
  const { wrapper } = queryWrapper();

  const hook = renderHook(
    () => useCommunityCompletedActionsCount({ communityId: 4, actions: [] }),
    { wrapper },
  );

  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.error).toMatchObject({ statusCode: 403 });
  expect(hook.result.current.data).toBeUndefined();
});
