import type { UserActionRelationsResponseDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useActionRelationsAdmin } from "./useActionRelationsAdmin";

afterEach(cleanup);

const relations: UserActionRelationsResponseDto = {
  actions: [
    {
      id: 7,
      name: "Call your representative",
      status: "member_action",
      weekNumber: 1,
      allMembersParticipating: false,
      memberActionDeadline: null,
    },
  ],
  suites: [],
  users: [{ userId: 3, relations: [{ actionId: 7, status: "completed" }] }],
};

let respond: () => Response;

serveApi(
  routes({
    "GET /actions/action-relations": () => respond(),
  }),
);

beforeEach(() => {
  respond = () => Response.json(relations);
});

describe("useActionRelationsAdmin", () => {
  it("reads every member's relations to the actions", async () => {
    const view = renderHook(() => useActionRelationsAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.data).toEqual(relations));
  });

  it("surfaces a refused load as an error carrying its status", async () => {
    respond = () => Response.json({ message: "Forbidden" }, { status: 403 });

    const view = renderHook(() => useActionRelationsAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.error).toMatchObject({ statusCode: 403 });
  });
});
