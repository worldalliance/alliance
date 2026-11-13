import {
  KORA_EXAMPLE_PATH,
  KORA_PROJECT_PATH,
  KORA_REVIEW_PATH,
  KoraReviewPhase,
  KoraUserBatchStatus,
} from "@alliance/common/kora";
import type { KoraHomeDto, KoraUserBatchDto } from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, test } from "bun:test";
import { MemoryRouter, Route, Routes } from "react-router";
import { HOME_COPY } from "./copy";
import { EXAMPLE_OPENED_KEY, KoraHomeBase } from "./KoraHomeBase";

let home: KoraHomeDto;
let homeFails: boolean;
let moreFails: boolean;
let moreRequests: number;

const future = new Date(Date.now() + 20 * 86_400_000).toISOString();
const row = (overrides: Partial<KoraUserBatchDto>): KoraUserBatchDto => ({
  id: "a1",
  status: KoraUserBatchStatus.Open,
  releasedAt: "2026-11-17T10:00:00.000Z",
  closesAt: future,
  progress: 0,
  total: 10,
  ...overrides,
});
const offer = row({ id: null, status: KoraUserBatchStatus.Ready });

serveApi(
  routes({
    "GET /kora/review/home": () =>
      homeFails ? new Response(null, { status: 500 }) : Response.json(home),
    "POST /kora/review/more": () => {
      moreRequests++;
      return moreFails
        ? new Response(null, { status: 500 })
        : Response.json({
            phase: KoraReviewPhase.Reviewing,
            reviewerId: "rv1",
            collectProfile: true,
            reviewed: false,
            extraReviews: 0,
          });
    },
  }),
);

beforeEach(() => {
  home = { totalRanked: 0, userBatches: [offer] };
  homeFails = false;
  moreFails = false;
  moreRequests = 0;
  localStorage.clear();
});

const renderHome = () =>
  render(
    <MemoryRouter initialEntries={[KORA_PROJECT_PATH]}>
      <QueryClientProvider client={new QueryClient()}>
        <Routes>
          <Route path={KORA_PROJECT_PATH} element={<KoraHomeBase />} />
          <Route path={KORA_REVIEW_PATH} element={<p>Review page</p>} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );

test("offers a newcomer their first pairs and the example, without a table", async () => {
  renderHome();
  await screen.findByRole("heading", { level: 1, name: /^Rank 10 pairs by / });
  expect(
    screen
      .getByRole("link", { name: HOME_COPY.exampleButton })
      .getAttribute("href"),
  ).toBe(KORA_EXAMPLE_PATH);
  expect(screen.queryByText(/ranked so far/)).toBeNull();
  expect(screen.queryByRole("table")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Start ranking" }));
  await screen.findByText("Review page");
  expect(moreRequests).toBe(1);
});

test("says when the pairs couldn't be started, and stays put", async () => {
  moreFails = true;
  renderHome();
  fireEvent.click(await screen.findByRole("button", { name: "Start ranking" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    HOME_COPY.startFailed,
  );
});

test("lists a returning participant's user-batches, with a smaller link to the example", async () => {
  localStorage.setItem(EXAMPLE_OPENED_KEY, "true");
  home = {
    totalRanked: 13,
    userBatches: [
      row({ id: "a2", progress: 3 }),
      row({ status: KoraUserBatchStatus.Done, progress: 10 }),
    ],
  };
  renderHome();
  await screen.findByRole("heading", {
    level: 1,
    name: /^Rank 7 more pairs by /,
  });
  expect(screen.getByText("13 pairs ranked so far")).toBeTruthy();
  expect(
    screen.queryByRole("heading", { name: HOME_COPY.exampleHeading }),
  ).toBeNull();
  expect(
    screen
      .getByRole("link", { name: HOME_COPY.exampleAgain })
      .getAttribute("href"),
  ).toBe(KORA_EXAMPLE_PATH);

  const [, open, done] = within(screen.getByRole("table")).getAllByRole("row");
  expect(within(open).getByText("3 of 10")).toBeTruthy();
  expect(
    within(open).getByRole("link", { name: "Continue" }).getAttribute("href"),
  ).toBe(KORA_REVIEW_PATH);
  expect(within(done).getByText("Done")).toBeTruthy();
});

test("says all caught up when nothing is open", async () => {
  home = {
    totalRanked: 10,
    userBatches: [row({ status: KoraUserBatchStatus.Done, progress: 10 })],
  };
  renderHome();
  await screen.findByRole("heading", {
    level: 1,
    name: "You’re all caught up",
  });
  expect(screen.queryByRole("button", { name: /rank/i })).toBeNull();
});

test("says so when the page can't load", async () => {
  homeFails = true;
  renderHome();
  expect(
    (await screen.findByRole("alert", {}, { timeout: 3000 })).textContent,
  ).toBe(HOME_COPY.loadFailed);
});

test("starts an offered user-batch from its row, after a closed one", async () => {
  home = {
    totalRanked: 4,
    userBatches: [
      offer,
      row({ status: KoraUserBatchStatus.Closed, progress: 4 }),
    ],
  };
  renderHome();
  const [, ready, closed] = within(
    await screen.findByRole("table"),
  ).getAllByRole("row");
  expect(within(closed).getByText("Closed")).toBeTruthy();
  expect(within(closed).queryByRole("button")).toBeNull();
  fireEvent.click(within(ready).getByRole("button", { name: "Start" }));
  await screen.findByText("Review page");
  expect(moreRequests).toBe(1);
});
