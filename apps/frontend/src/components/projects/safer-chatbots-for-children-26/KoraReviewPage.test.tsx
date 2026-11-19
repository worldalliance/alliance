import {
  KORA_PROJECT_PATH,
  KORA_REVIEW_PATH,
  KoraReviewPhase,
} from "@alliance/common/kora";
import { SAMPLE_ITEMS } from "@alliance/kora-review/sample-export";
import type {
  KoraParticipantDto,
  KoraReviewStateDto,
} from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "bun:test";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { AuthContext } from "../../../lib/AuthContext";
import { InviteSessionProvider } from "../../../site/invite/InviteSession";
import { authValue } from "../../../testing/authValue";
import { REVIEW_COPY } from "./copy";
import KoraReviewPage from "./KoraReviewPage";

let participant: KoraParticipantDto | null;
let review: KoraReviewStateDto;
let moreRequests: number;

const reviewing = (number = 1): KoraReviewStateDto => ({
  phase: KoraReviewPhase.Reviewing,
  reviewerId: "rv1",
  optOutRisks: [],
  extendedOptIn: false,
  reviewed: number > 1,
  sessionsCompleted: number - 1,
  ratingsCompleted: 0,
  onboarding: {
    demographics: null,
    consentAt: "2026-11-18T10:00:00.000Z",
    onboardedAt: "2026-11-18T10:00:00.000Z",
  },
  session: {
    id: "ses1",
    number,
    budgetUnits: 5,
    items: [{ item: { ...SAMPLE_ITEMS[1] } }],
    savedExport: null,
  },
});
const summary = (
  phase: KoraReviewPhase,
  reviewed: boolean,
  ratingsCompleted = 0,
): KoraReviewStateDto => ({
  phase,
  reviewerId: "rv1",
  optOutRisks: [],
  extendedOptIn: false,
  reviewed,
  sessionsCompleted: reviewed ? 1 : 0,
  ratingsCompleted,
  onboarding: {
    demographics: null,
    consentAt: "2026-11-18T10:00:00.000Z",
    onboardedAt: "2026-11-18T10:00:00.000Z",
  },
  session: undefined,
});

serveApi(
  routes({
    "GET /kora/me": () =>
      Response.json({ participant, pendingCode: null, signupPending: false }),
    "GET /kora/project": () => Response.json({ status: "active" }),
    "GET /kora/review": () => Response.json(review),
    "POST /kora/review/more": () => {
      moreRequests++;
      review = reviewing(2);
      return Response.json(review);
    },
    // The tool saves the session's first state as it mounts.
    "PUT /kora/review/sessions/:id/export": () =>
      Response.json({ ended: false, removed: [] }),
  }),
);

beforeEach(() => {
  participant = { id: "p1", name: "Test Person", maskedContact: "•••0042" };
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

test("mounts the review tool for the reviewer's session", async () => {
  const { container } = renderPage();
  await waitFor(() =>
    expect(container.querySelector(".kr-app")).not.toBeNull(),
  );
});

test("thanks a reviewer who finished, and starts another session on request", async () => {
  review = summary(KoraReviewPhase.Finished, true, 4);
  const { container } = renderPage();

  await screen.findByRole("heading", { name: REVIEW_COPY.thanksHeading });
  screen.getByText(REVIEW_COPY.judgedSoFar(4));
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
