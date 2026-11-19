import { KORA_ACCOUNT_PATH, KoraReviewPhase } from "@alliance/common/kora";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "bun:test";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthContext } from "../../../lib/AuthContext";
import { InviteSessionProvider } from "../../../site/invite/InviteSession";
import { authValue } from "../../../testing/authValue";
import { ACCOUNT_COPY, ONBOARDING_COPY } from "./copy";
import KoraAccountPage from "./KoraAccountPage";

let optOutRisks: string[];
let extendedOptIn: boolean;
let sent: Record<string, unknown>[];

serveApi(
  routes({
    "GET /kora/me": () =>
      Response.json({
        participant: { id: "p1", name: "Test Person", maskedContact: "•••42" },
        pendingCode: null,
        signupPending: false,
      }),
    "GET /kora/review": () =>
      Response.json({
        phase: KoraReviewPhase.Reviewing,
        reviewerId: "rv1",
        optOutRisks,
        extendedOptIn,
        reviewed: false,
        sessionsCompleted: 0,
        ratingsCompleted: 0,
        onboarding: {
          demographics: null,
          consentAt: "2026-11-18T10:00:00.000Z",
          onboardedAt: "2026-11-18T10:00:00.000Z",
        },
        session: undefined,
      }),
    "PATCH /kora/review/preferences": async ({ request }) => {
      const body = await request.json();
      sent.push(body);
      return Response.json({ optOutRisks: [], extendedOptIn: false });
    },
  }),
);

beforeEach(() => {
  optOutRisks = ["cybersecurity"];
  extendedOptIn = false;
  sent = [];
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={[KORA_ACCOUNT_PATH]}>
      <QueryClientProvider client={new QueryClient()}>
        <AuthContext.Provider value={authValue({})}>
          <InviteSessionProvider>
            <Routes>
              <Route path={KORA_ACCOUNT_PATH} element={<KoraAccountPage />} />
            </Routes>
          </InviteSessionProvider>
        </AuthContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>,
  );

test("shows the risks the reviewer still sees, with the opted-out one unticked", async () => {
  renderPage();
  await screen.findByText(ACCOUNT_COPY.heading);
  const ticks = await screen.findAllByRole("checkbox");
  expect(ticks).toHaveLength(26);
  expect(
    ticks.filter((tick) => !(tick as HTMLInputElement).checked),
  ).toHaveLength(1);
});

test("saves a risk put back and the longer-conversations choice together", async () => {
  renderPage();
  await screen.findByText(ACCOUNT_COPY.heading);

  const unticked = (await screen.findAllByRole("checkbox")).find(
    (tick) => !(tick as HTMLInputElement).checked,
  );
  if (!unticked) throw new Error("every risk is already ticked");
  fireEvent.click(unticked);
  fireEvent.click(screen.getByLabelText(ONBOARDING_COPY.extendedYes));
  fireEvent.click(screen.getByRole("button", { name: ACCOUNT_COPY.save }));

  await waitFor(() => expect(sent).toHaveLength(1));
  expect(sent[0]).toEqual({ optOutRisks: [], extendedOptIn: true });
  await screen.findByText(ACCOUNT_COPY.saved);
});
