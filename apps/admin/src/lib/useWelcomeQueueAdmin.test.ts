import type { WelcomeQueueDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { renderHook, waitFor } from "@testing-library/react";
import { useWelcomeQueueAdmin } from "./useWelcomeQueueAdmin";

const queue: WelcomeQueueDto = { requiredActionCount: 2, members: [] };

let respond: () => Response;

serveApi(
  routes({
    "GET /actions/welcome-queue": () => respond(),
  }),
);

beforeEach(() => {
  respond = () => Response.json(queue);
});

describe("useWelcomeQueueAdmin", () => {
  it("reads the members who need a welcome", async () => {
    const view = renderHook(() => useWelcomeQueueAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.data).toEqual(queue));
  });

  it("surfaces a refused load as an error carrying its status", async () => {
    respond = () => Response.json({ message: "Forbidden" }, { status: 403 });

    const view = renderHook(() => useWelcomeQueueAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.isError).toBe(true));
    expect(view.result.current.error).toMatchObject({ statusCode: 403 });
  });
});
