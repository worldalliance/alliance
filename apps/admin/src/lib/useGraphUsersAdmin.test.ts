import { makeUser } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useGraphUsersAdmin } from "./useGraphUsersAdmin";

afterEach(cleanup);

const users = [makeUser({ id: 3, name: "Sam" })];

let respond: () => Response;

serveApi(
  routes({
    "GET /user/list-graph": () => respond(),
  }),
);

beforeEach(() => {
  respond = () => Response.json(users);
});

describe("useGraphUsersAdmin", () => {
  it("reads every user with their graph fields", async () => {
    const view = renderHook(() => useGraphUsersAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.data).toEqual(users));
  });

  it("surfaces a refused load as an error carrying its status", async () => {
    respond = () => Response.json({ message: "Forbidden" }, { status: 403 });

    const view = renderHook(() => useGraphUsersAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.error).toMatchObject({ statusCode: 403 });
  });
});
