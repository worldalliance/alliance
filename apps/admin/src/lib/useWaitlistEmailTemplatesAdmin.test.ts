import type { WaitlistEmailTemplateDto } from "@alliance/shared/client/types.gen";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { useWaitlistEmailTemplatesAdmin } from "./useWaitlistEmailTemplatesAdmin";

afterEach(cleanup);

const template = {
  id: 8,
  name: "Invitation",
  subject: "You're invited, #{name}",
  body: "Join: #{signupLink}",
  updatedAt: "2026-08-01T00:00:00.000Z",
} satisfies WaitlistEmailTemplateDto;

serveApi(
  routes({
    "GET /waitlist/admin/email-templates": () => Response.json([template]),
  }),
);

describe("useWaitlistEmailTemplatesAdmin", () => {
  it("loads the templates", async () => {
    const view = renderHook(
      () => useWaitlistEmailTemplatesAdmin(),
      queryWrapper(),
    );

    await waitFor(() => expect(view.result.current.data).toEqual([template]));
  });
});
