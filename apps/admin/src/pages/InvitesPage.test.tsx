import type { OnetimeInviteListDto } from "@alliance/shared/client";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { ToastProvider } from "@alliance/sharedweb/ui/ToastProvider";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router";
import InvitesPage from "./InvitesPage";

afterEach(cleanup);

serveApi(
  routes({
    "GET /user/onetimeInvites": () =>
      Response.json({
        items: [
          {
            id: 1,
            invitee: "Sam",
            code: "abc123",
            createdAt: "2026-01-02T00:00:00.000Z",
            status: "link_unused",
          },
        ],
        totalCount: 1,
        page: 1,
        limit: 50,
        totalPages: 1,
      } satisfies OnetimeInviteListDto),
    "GET /user/onetimeInvites/memberStats": () => Response.json([]),
    "GET /user/list": () => Response.json([]),
  }),
);

it("copies an invite's signup link from a labelled button", async () => {
  const writeText = jest
    .spyOn(navigator.clipboard, "writeText")
    .mockResolvedValue();
  render(
    <MemoryRouter>
      <ToastProvider>
        <InvitesPage />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

  fireEvent.click(
    await screen.findByRole("button", { name: "Copy invite link abc123" }),
  );

  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(
      expect.stringMatching(/\/signup\?ref=abc123$/),
    ),
  );
});
