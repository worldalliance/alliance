import type { AdminWaitlistLinkDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useWaitlistLinksAdmin } from "./useWaitlistLinksAdmin";

afterEach(cleanup);

const link = {
  id: 7,
  code: "newsletter1",
  organizationId: 3,
  channel: "Newsletter",
  publishedAt: null,
  archivedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  entryCount: 0,
} satisfies AdminWaitlistLinkDto;

serveApi(
  routes({
    "GET /waitlist/admin/links": () => Response.json([link]),
  }),
);

describe("useWaitlistLinksAdmin", () => {
  it("loads the links", async () => {
    const view = renderHook(() => useWaitlistLinksAdmin(), queryWrapper());

    await waitFor(() => expect(view.result.current.data).toEqual([link]));
  });
});
