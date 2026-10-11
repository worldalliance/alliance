import { renderHook, waitFor } from "@testing-library/react";
import { makeProfile } from "./testFixtures";
import { queryWrapper } from "./testing/queryWrapper";
import { routes, serveApi } from "./testing/serveApi";
import { useMembers } from "./useMembers";

let respond: () => Response;

serveApi(routes({ "GET /user/members": () => respond() }));

beforeEach(() => {
  respond = () =>
    Response.json([
      makeProfile(2),
      { ...makeProfile(3), hasActiveContract: false },
    ]);
});

it("loads every member, with or without an active contract", async () => {
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useMembers(), { wrapper });

  await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
  expect(hook.result.current.data).toEqual([
    makeProfile(2),
    { ...makeProfile(3), hasActiveContract: false },
  ]);
});

it("fails rather than reading a failed load as no members", async () => {
  respond = () =>
    Response.json({ message: "Internal server error" }, { status: 500 });
  const { wrapper } = queryWrapper();

  const hook = renderHook(() => useMembers(), { wrapper });

  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  expect(hook.result.current.error).toMatchObject({ statusCode: 500 });
  expect(hook.result.current.data).toBeUndefined();
});
