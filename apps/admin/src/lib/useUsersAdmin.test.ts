import { makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useUsersAdmin } from "./useUsersAdmin";

afterEach(cleanup);

const users = [makeUser({ id: 3, name: "Sam" })];

serveApi(routes({ "GET /user/list": () => Response.json(users) }));

describe("useUsersAdmin", () => {
  it("reads every user", async () => {
    const view = renderHook(() => useUsersAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.data).toEqual(users));
  });
});
