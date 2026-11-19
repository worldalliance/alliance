import {
  KORA_ACCOUNT_PATH,
  KORA_PROJECT_PATH,
  KoraReviewPhase,
} from "@alliance/common/kora";
import { parseKoraExport, parseKoraItem } from "@alliance/kora-review/parse";
import type { KoraReviewStateDto } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useMemo } from "react";
import { Navigate, useNavigate } from "react-router";
import { z } from "zod";
import { useAuth } from "../../../lib/AuthContext";
import { socialPreviewMeta } from "../../../lib/socialPreviewMeta";
import { SITE_COL } from "../../../site/ui";
import { REVIEW_COPY } from "./copy";
import { KoraOnboarding } from "./KoraOnboarding";
import { KoraPageShell } from "./KoraPageShell";
import { type KoraToolOptions, KoraReviewTool } from "./KoraReviewTool";
import { useKoraParticipant } from "./useKoraParticipant";
import {
  nextKoraConversation,
  saveKoraExport,
  setKoraPreferences,
  useKoraReview,
} from "./useKoraReview";

export const SIGN_IN_TO_REVIEW = `${KORA_PROJECT_PATH}?next=review`;

export function meta() {
  return socialPreviewMeta({
    title: "Review conversations — Safer Chatbots for Children",
    description:
      "Review conversations between children and AI chatbots, for the Alliance and KORA.",
    url: `${KORA_PROJECT_PATH}/review`,
  });
}

function ReviewTool({
  state,
  onComplete,
  onPreferencesChanged,
}: {
  state: KoraReviewStateDto;
  onComplete: (end: { again: boolean }) => void;
  onPreferencesChanged: () => void;
}) {
  const navigate = useNavigate();
  const session = state.session;
  const optOutRisks = state.optOutRisks;
  const options = useMemo(
    (): KoraToolOptions | null =>
      session
        ? {
            reviewerId: state.reviewerId,
            session: {
              id: session.id,
              number: session.number,
              budgetUnits: session.budgetUnits,
              items: session.items.map((i) => parseKoraItem(i.item)),
            },
            savedExport: session.savedExport
              ? parseKoraExport(session.savedExport)
              : null,
            save: (exported) => saveKoraExport(session.id, { ...exported }),
            next: () => nextKoraConversation(session.id),
            onOptOutRisk: (riskId) => {
              void setKoraPreferences({
                optOutRisks: [...new Set([...optOutRisks, riskId])],
              }).then(onPreferencesChanged);
            },
            onOpenAccount: () => void navigate(KORA_ACCOUNT_PATH),
          }
        : null,
    [session, state.reviewerId, optOutRisks, navigate, onPreferencesChanged],
  );
  return (
    options && <KoraReviewTool options={options} onComplete={onComplete} />
  );
}

function Finished({
  state,
  more,
}: {
  state: KoraReviewStateDto;
  more: ReturnType<typeof useKoraReview>["more"];
}) {
  if (!state.reviewed) {
    return <p role="status">{REVIEW_COPY.noneLeft}</p>;
  }
  return (
    <section className="flex flex-col gap-4" aria-labelledby="kora-thanks">
      <h1 id="kora-thanks" className="site-display text-4xl font-medium">
        {REVIEW_COPY.thanksHeading}
      </h1>
      <p className="text-lg">{REVIEW_COPY.thanksBody}</p>
      {state.ratingsCompleted > 0 && (
        <p>{REVIEW_COPY.judgedSoFar(state.ratingsCompleted)}</p>
      )}
      {state.phase === KoraReviewPhase.NoneLeft ? (
        <p role="status">{REVIEW_COPY.noneLeft}</p>
      ) : (
        <Button
          color={ButtonColor.Black}
          className="self-start"
          disabled={more.isPending}
          onClick={() => more.mutate()}
        >
          {REVIEW_COPY.reviewMore}
        </Button>
      )}
      {more.isError && (
        <p role="alert" className="text-red-700">
          {REVIEW_COPY.loadFailed}
        </p>
      )}
    </section>
  );
}

export default function KoraReviewPage() {
  const member = useAuth();
  const { query: participantQuery } = useKoraParticipant();
  const signedIn =
    member.isAuthenticated || Boolean(participantQuery.data?.participant);
  const review = useKoraReview(signedIn);
  const shell = (children: React.ReactNode, busy = false) => (
    <KoraPageShell busy={busy}>{children}</KoraPageShell>
  );

  if (member.loading || participantQuery.isPending) {
    return shell(null, true);
  }
  if (!signedIn) return <Navigate to={SIGN_IN_TO_REVIEW} replace />;
  if (review.query.isPending) return shell(null, true);
  if (review.query.isError) {
    return shell(
      <p role="alert" className={cn(SITE_COL, "py-10 text-red-700")}>
        {REVIEW_COPY.loadFailed}
      </p>,
    );
  }
  const state = review.query.data;
  const phase = z.enum(KoraReviewPhase).parse(state.phase);
  switch (phase) {
    case KoraReviewPhase.NotActive:
      return <Navigate to={KORA_PROJECT_PATH} replace />;
    case KoraReviewPhase.Onboarding:
      return shell(
        <KoraOnboarding state={state} onDone={() => void review.refresh()} />,
      );
    case KoraReviewPhase.Reviewing:
      return shell(
        <ReviewTool
          state={state}
          onComplete={({ again }) =>
            again ? review.more.mutate() : void review.refresh()
          }
          onPreferencesChanged={() => void review.refresh()}
        />,
      );
    case KoraReviewPhase.Finished:
    case KoraReviewPhase.NoneLeft:
      return shell(
        <div className={cn(SITE_COL, "max-w-2xl py-12")}>
          <Finished state={state} more={review.more} />
        </div>,
      );
    default:
      throw new Error(`unknown phase: ${phase satisfies never}`);
  }
}
