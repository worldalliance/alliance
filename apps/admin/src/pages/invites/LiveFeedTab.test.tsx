import type {
  OnetimeInviteListDto,
  ReusableInviteFeedDto,
} from "@alliance/shared/client";
import { makeOnetimeInvite } from "@alliance/shared/lib/testFixtures";
import { queryWrapper } from "@alliance/shared/lib/testing/queryWrapper";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, setSystemTime } from "bun:test";
import { MemoryRouter } from "react-router";
import { ToastProvider } from "../../ui/ToastProvider";
import InvitesPage from "./InvitesPage";
import { FEED_SETTINGS_KEY } from "./useInviteFeed";

serveApi(
  routes({
    "GET /user/onetimeInvites": () =>
      Response.json({
        items: [
          makeOnetimeInvite({
            id: 2,
            createdAt: "2026-03-02T10:00:00.000Z",
            status: "link_unused",
          }),
          makeOnetimeInvite({
            id: 1,
            createdAt: "2026-02-01T10:00:00.000Z",
            status: "link_used",
          }),
        ],
        totalCount: 2,
        page: 1,
        limit: 200,
        totalPages: 1,
      } satisfies OnetimeInviteListDto),
    "GET /share-urls/invite-feed": () =>
      Response.json({
        items: [
          {
            id: "7",
            createdAt: "2026-03-03T10:00:00.000Z",
            invitingUserDisplayName: "Robin",
            communityId: null,
          },
        ],
      } satisfies ReusableInviteFeedDto),
  }),
);

beforeEach(() => {
  setSystemTime(new Date("2026-03-03T12:00:00"));
  localStorage.setItem(
    FEED_SETTINGS_KEY,
    JSON.stringify({ numbered: true, startAt: "2026-03-01T00:00" }),
  );
});
afterEach(() => {
  setSystemTime();
  localStorage.clear();
});

const renderTab = () =>
  render(
    <MemoryRouter initialEntries={["/growth/invites?tab=feed"]}>
      <ToastProvider>
        <InvitesPage />
      </ToastProvider>
    </MemoryRouter>,
    queryWrapper(),
  );

const rows = async () => {
  const panel = await screen.findByRole("region", { name: "Invites" });
  await within(panel).findByText("Robin");
  return within(panel)
    .getAllByRole("row")
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    );
};

it("counts invites since the stored start, newest first and numbered", async () => {
  renderTab();
  const shown = await rows();
  expect(shown.map((cells) => cells.slice(0, 3))).toEqual([
    ["2", "Robin", "Group"],
    ["1", shown[1][1], "Individual"],
  ]);
  expect(screen.getByText("Invites since Mar 1, 12:00 AM")).toBeTruthy();
});

it("drops the numbers and keeps that choice in this browser", async () => {
  renderTab();
  await rows();
  fireEvent.click(screen.getByLabelText("Number each invite"));
  expect((await rows())[0][0]).toBe("Robin");
  expect(JSON.parse(localStorage.getItem(FEED_SETTINGS_KEY) ?? "")).toEqual({
    numbered: false,
    startAt: "2026-03-01T00:00",
  });
});

it("links to the full-screen feed", async () => {
  renderTab();
  expect(
    screen.getByRole("link", { name: "Full screen" }).getAttribute("href"),
  ).toBe("/growth/invites/feed");
});
