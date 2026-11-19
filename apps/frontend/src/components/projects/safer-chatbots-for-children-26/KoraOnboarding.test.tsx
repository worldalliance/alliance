import { KoraReviewPhase } from "@alliance/common/kora";
import type { KoraReviewStateDto } from "@alliance/shared/client";
import { routes, serveApi } from "@alliance/shared/lib/testing/serveApi";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test } from "bun:test";
import { ONBOARDING_COPY } from "./copy";
import { KoraOnboarding } from "./KoraOnboarding";

let onboardingSent: Record<string, unknown>[];
let preferencesSent: Record<string, unknown>[];
let done: number;

serveApi(
  routes({
    "PATCH /kora/review/onboarding": async ({ request }) => {
      onboardingSent.push(await request.json());
      return Response.json({
        demographics: null,
        consentAt: null,
        onboardedAt: null,
      });
    },
    "PATCH /kora/review/preferences": async ({ request }) => {
      preferencesSent.push(await request.json());
      return Response.json({ optOutRisks: [], extendedOptIn: false });
    },
  }),
);

const state = (
  onboarding: KoraReviewStateDto["onboarding"],
): KoraReviewStateDto => ({
  phase: KoraReviewPhase.Onboarding,
  reviewerId: "rv1",
  optOutRisks: [],
  extendedOptIn: false,
  reviewed: false,
  sessionsCompleted: 0,
  ratingsCompleted: 0,
  onboarding,
  session: undefined,
});

const fresh = state({
  demographics: null,
  consentAt: null,
  onboardedAt: null,
});

beforeEach(() => {
  onboardingSent = [];
  preferencesSent = [];
  done = 0;
});

const renderFlow = (from: KoraReviewStateDto = fresh) =>
  render(<KoraOnboarding state={from} onDone={() => done++} />);

const continueOn = (label = ONBOARDING_COPY.continue) =>
  fireEvent.click(screen.getByRole("button", { name: label }));

test("walks the six screens in the order the spec sets out", async () => {
  renderFlow();

  await screen.findByText(ONBOARDING_COPY.demographicsHeading);
  expect(screen.getByText(ONBOARDING_COPY.step(1, 6))).toBeTruthy();
  continueOn();

  await screen.findByText(ONBOARDING_COPY.risksHeading);
  continueOn();
  await screen.findByText(ONBOARDING_COPY.extendedHeading);
  continueOn();
  await screen.findByText(ONBOARDING_COPY.consentHeading);

  fireEvent.click(screen.getByLabelText(ONBOARDING_COPY.consentTick));
  continueOn(ONBOARDING_COPY.consentContinue);
  await screen.findByText(ONBOARDING_COPY.warningHeading);
  continueOn();

  await screen.findByText(ONBOARDING_COPY.instructionsHeading);
  continueOn(ONBOARDING_COPY.startReviewing);
  await waitFor(() => expect(done).toBe(1));

  expect(onboardingSent).toEqual([
    { demographics: expect.objectContaining({ ageBand: null }) },
    { consented: true },
    { onboarded: true },
  ]);
});

test("will not take consent until the box is ticked", async () => {
  renderFlow(
    state({
      demographics: null,
      consentAt: null,
      onboardedAt: null,
    }),
  );
  await screen.findByText(ONBOARDING_COPY.demographicsHeading);
  continueOn();
  await screen.findByText(ONBOARDING_COPY.risksHeading);
  continueOn();
  await screen.findByText(ONBOARDING_COPY.extendedHeading);
  continueOn();
  await screen.findByText(ONBOARDING_COPY.consentHeading);

  continueOn(ONBOARDING_COPY.consentContinue);
  expect(screen.getByRole("alert").textContent).toBe(
    ONBOARDING_COPY.consentNeeded,
  );
  expect(onboardingSent).toEqual([
    { demographics: expect.objectContaining({ ageBand: null }) },
  ]);
});

test("sends the risks the reviewer unticked, and warns below three", async () => {
  renderFlow();
  await screen.findByText(ONBOARDING_COPY.demographicsHeading);
  continueOn();
  await screen.findByText(ONBOARDING_COPY.risksHeading);

  const ticks = screen.getAllByRole("checkbox");
  expect(ticks).toHaveLength(26);
  for (const tick of ticks.slice(0, 24)) fireEvent.click(tick);
  await screen.findByText(ONBOARDING_COPY.risksWarning);
  expect(screen.getByText(ONBOARDING_COPY.risksLeft(2))).toBeTruthy();

  continueOn();
  await screen.findByText(ONBOARDING_COPY.extendedHeading);
  expect(preferencesSent).toHaveLength(1);
  expect(preferencesSent[0].optOutRisks).toHaveLength(24);
});

test("opts in to longer conversations when asked", async () => {
  renderFlow(
    state({
      demographics: null,
      consentAt: null,
      onboardedAt: null,
    }),
  );
  await screen.findByText(ONBOARDING_COPY.demographicsHeading);
  continueOn();
  await screen.findByText(ONBOARDING_COPY.risksHeading);
  continueOn();
  await screen.findByText(ONBOARDING_COPY.extendedHeading);

  fireEvent.click(screen.getByLabelText(ONBOARDING_COPY.extendedYes));
  continueOn();
  await screen.findByText(ONBOARDING_COPY.consentHeading);
  expect(preferencesSent[1]).toEqual({ extendedOptIn: true });
});

test("comes back to the screen after the last one answered", async () => {
  renderFlow(
    state({
      demographics: null,
      consentAt: "2026-11-18T10:00:00.000Z",
      onboardedAt: null,
    }),
  );
  await screen.findByText(ONBOARDING_COPY.warningHeading);
  expect(screen.queryByText(ONBOARDING_COPY.consentHeading)).toBeNull();
});
