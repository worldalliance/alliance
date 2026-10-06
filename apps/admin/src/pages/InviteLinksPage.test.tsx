import type { InviteLinkPageDto } from "@alliance/shared/client/types.gen";
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
import { afterEach, beforeEach, expect, it } from "bun:test";
import InviteLinksPage from "./InviteLinksPage";

let requests: URLSearchParams[];
let status: number;
let empty: boolean;
serveApi(
  routes({
    "GET /share-urls/admin/invite-links": ({ request }) => {
      const query = new URL(request.url).searchParams;
      requests.push(query);
      if (status !== 200)
        return Response.json(
          { message: "Unavailable", statusCode: status },
          { status },
        );
      const page = Number(query.get("page"));
      return Response.json({
        items: empty
          ? []
          : [
              {
                id: `share:${page}`,
                label: `Link ${page}`,
                kind: "multi_use",
                url: `https://example.com/signup?ref=link-${page}`,
                createdAt: "2026-09-01T12:00:00.000Z",
                accountsCreated: 8,
                initialSigners: 4,
                retainedSigners: 3,
              },
              {
                id: `individual:${page}`,
                label: "Unused link",
                kind: "individual",
                url: "https://example.com/signup?ref=unused",
                createdAt: "2026-09-01T12:00:00.000Z",
                accountsCreated: 0,
                initialSigners: 0,
                retainedSigners: 0,
              },
            ],
        page,
        limit: 50,
        totalCount: empty ? 0 : 100,
        totalPages: empty ? 0 : 2,
      } satisfies InviteLinkPageDto);
    },
  }),
);

beforeEach(() => {
  requests = [];
  status = 200;
  empty = false;
});
afterEach(cleanup);
const renderPage = () =>
  render(
    <ToastProvider>
      <InviteLinksPage />
    </ToastProvider>,
    queryWrapper(),
  );

it("shows per-link counts and retention, fetching just the selected page", async () => {
  renderPage();
  expect(await screen.findByText("Link 1")).toBeTruthy();
  expect(screen.getByText("75% (3/4)")).toBeTruthy();
  expect(screen.getByText("—")).toBeTruthy();
  expect(requests[0].get("limit")).toBe("50");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(await screen.findByText("Link 2")).toBeTruthy();
  expect(requests.map((query) => query.get("page"))).toEqual(["1", "2"]);
});

it("sends filters and sorts to the server and resets to page one", async () => {
  renderPage();
  await screen.findByText("Link 1");
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await screen.findByText("Link 2");
  fireEvent.change(screen.getByRole("combobox", { name: "Invite link type" }), {
    target: { value: "individual" },
  });
  await waitFor(() => expect(requests.at(-1)?.get("kind")).toBe("individual"));
  expect(requests.at(-1)?.get("page")).toBe("1");
  fireEvent.change(
    screen.getByRole("combobox", { name: "Sort invite links" }),
    { target: { value: "most_used" } },
  );
  await waitFor(() => expect(requests.at(-1)?.get("sort")).toBe("most_used"));
  expect(requests.at(-1)?.get("page")).toBe("1");
});

it("shows an empty result without page controls", async () => {
  empty = true;
  renderPage();
  expect(
    await screen.findByText("No invite links match this filter."),
  ).toBeTruthy();
  expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
});

it("allows retrying a failed request", async () => {
  status = 500;
  renderPage();
  expect(await screen.findByRole("alert")).toBeTruthy();
  status = 200;
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Link 1")).toBeTruthy();
});
