import {
  KORA_PROJECT_PATH,
  KORA_REVIEW_PATH,
  KoraReviewPhase,
} from "@alliance/common/kora";
import type {
  KoraParticipantDto,
  KoraReviewStateDto,
} from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "bun:test";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import sampleTranscript from "../../../../../../kora-review/samples/transcript.json";
import { AuthContext } from "../../../lib/AuthContext";
import { InviteSessionProvider } from "../../../site/invite/InviteSession";
import { authValue } from "../../../testing/authValue";
import { REVIEW_COPY } from "./copy";
import KoraReviewPage from "./KoraReviewPage";

let participant: KoraParticipantDto | null;
let review: KoraReviewStateDto;
let moreRequests: number;

const HASH = `sha256:${"0".repeat(64)}`;
const reviewing = (extra = false): KoraReviewStateDto => ({
  phase: KoraReviewPhase.Reviewing,
  reviewerId: "rv1",
  collectProfile: true,
  reviewed: extra,
  extraReviews: 0,
  assignment: {
    id: "as1",
    extra,
    transcripts: [{ transcript: sampleTranscript, contentHash: HASH }],
    savedExport: null,
  },
});
const summary = (
  phase: KoraReviewPhase,
  reviewed: boolean,
  extraReviews = 0,
): KoraReviewStateDto => ({
  phase,
  reviewerId: "rv1",
  collectProfile: false,
  reviewed,
  extraReviews,
});

serveApi(
  routes({
    "GET /kora/me": () =>
      Response.json({ participant, pendingCode: null, signupPending: false }),
    "GET /kora/project": () => Response.json({ status: "active" }),
    "GET /kora/review": () => Response.json(review),
    "POST /kora/review/more": () => {
      moreRequests++;
      review = reviewing(true);
      return Response.json(review);
    },
  }),
);

beforeEach(() => {
  participant = { id: "p1", name: "Test Person" };
  review = reviewing();
  moreRequests = 0;
});

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[KORA_REVIEW_PATH]}>
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={authValue({})}>
          <InviteSessionProvider>
            <Routes>
              <Route path={KORA_REVIEW_PATH} element={<KoraReviewPage />} />
              <Route path={KORA_PROJECT_PATH} element={<Where />} />
            </Routes>
          </InviteSessionProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

test("sends a signed-out visitor to sign in on the project page, then back", async () => {
  participant = null;
  renderPage();
  expect((await screen.findByTestId("where")).textContent).toBe(
    `${KORA_PROJECT_PATH}?next=review`,
  );
});

test("mounts the review tool for the reviewer's assignment", async () => {
  const { container } = renderPage();
  await waitFor(() =>
    expect(container.querySelector(".kr-app")).not.toBeNull(),
  );
});

test("thanks a reviewer who finished, and starts extra reviews on request", async () => {
  review = summary(KoraReviewPhase.Finished, true, 4);
  const { container } = renderPage();

  await screen.findByRole("heading", { name: REVIEW_COPY.thanksHeading });
  screen.getByText(REVIEW_COPY.extraReviews(4));
  fireEvent.click(screen.getByRole("button", { name: REVIEW_COPY.reviewMore }));
  await waitFor(() =>
    expect(container.querySelector(".kr-app")).not.toBeNull(),
  );
  expect(moreRequests).toBe(1);
});

test("says there's nothing left, without thanking someone who hasn't reviewed", async () => {
  review = summary(KoraReviewPhase.NoneLeft, false);
  renderPage();
  await screen.findByText(REVIEW_COPY.noneLeft);
  expect(
    screen.queryByRole("heading", { name: REVIEW_COPY.thanksHeading }),
  ).toBeNull();
});

test("sends a reviewer back to the project page before the project is active", async () => {
  review = summary(KoraReviewPhase.NotActive, false);
  renderPage();
  expect((await screen.findByTestId("where")).textContent).toBe(
    KORA_PROJECT_PATH,
  );
});
