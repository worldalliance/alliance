import { renderHook, waitFor } from "@testing-library/react";
import { makeProfile } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useMembersWithFriends } from "./useMembersWithFriends";

let requested: (string | null)[] = [];
let respond: () => Response;

serveApi(
  routes({
    "GET /user/membersWithFriends": ({ request }) => {
      requested.push(
        new URL(request.url).searchParams.get("requireSignedContract"),
      );
      return respond();
    },
  }),
);

beforeEach(() => {
  requested = [];
  respond = () => Response.json([{ ...makeProfile(2), friendIds: [3] }]);
});

it("loads the members with an active contract, with their friends", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useMembersWithFriends(), { wrapper });

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(hook.result.current.data).toEqual([
    { ...makeProfile(2), friendIds: [3] },
  ]);
  expect(requested).toEqual(["true"]);
});

it("fails rather than reading a failed load as no members", async () => {
  respond = () =>
    Response.json({ message: "Internal server error" }, { status: 500 });
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useMembersWithFriends(), { wrapper });

  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.error).toMatchObject({ statusCode: 500 });
  expect(hook.result.current.data).toBeUndefined();
});
