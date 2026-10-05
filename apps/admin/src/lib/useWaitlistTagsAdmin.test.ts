import type { AdminWaitlistTagDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useWaitlistTagsAdmin } from "./useWaitlistTagsAdmin";

afterEach(cleanup);

const tag = {
  id: 5,
  name: "Press",
  entryCount: 2,
} satisfies AdminWaitlistTagDto;

serveApi(
  routes({
    "GET /waitlist/admin/tags": () => Response.json([tag]),
  }),
);

describe("useWaitlistTagsAdmin", () => {
  it("loads the tags", async () => {
    const view = renderHook(() => useWaitlistTagsAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.data).toEqual([tag]));
  });
});
