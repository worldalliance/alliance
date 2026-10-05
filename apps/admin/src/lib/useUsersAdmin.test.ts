import { makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useUsersAdmin } from "./useUsersAdmin";

afterEach(cleanup);

const users = [makeUser({ id: 3, name: "Sam" })];

let listCalls = 0;

serveApi(
  routes({
    "GET /user/list": () => {
      listCalls += 1;
      return Response.json(users);
    },
  }),
);

afterEach(() => {
  listCalls = 0;
});

describe("useUsersAdmin", () => {
  it("reads every user", async () => {
    const view = renderHook(() => useUsersAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.data).toEqual(users));
  });

  it("does not fetch while disabled", () => {
    const view = renderHook(
      () => useUsersAdmin({ enabled: false }),
      queryWrapper(),
    );

    expect(view.result.current.fetchStatus).toBe("idle");
    expect(listCalls).toBe(0);
  });
});
