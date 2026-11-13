import { KORA_PROJECT_PATH, KoraReviewPhase } from "@alliance/common/kora";
import {
  parseKoraExport,
  parseKoraTranscript,
} from "@alliance/kora-review/parse";
import type { KoraReviewStateDto } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useMemo } from "react";
import { Navigate } from "react-router";
import { z } from "zod";
import { useAuth } from "../../../lib/AuthContext";
import { socialPreviewMeta } from "../../../lib/socialPreviewMeta";
import { NAV_HEIGHT } from "../../../site/Navbar";
import { SiteRoot } from "../../../site/PageShell";
import { SITE_COL } from "../../../site/ui";
import { REVIEW_COPY } from "./copy";
import { KoraNavbar } from "./KoraNavbar";
import { type KoraToolOptions, KoraReviewTool } from "./KoraReviewTool";
import { useKoraParticipant } from "./useKoraParticipant";
import { saveKoraExport, useKoraReview } from "./useKoraReview";

export const SIGN_IN_TO_REVIEW = `${KORA_PROJECT_PATH}?next=review`;

export function meta() {
  return socialPreviewMeta({
    title: "Review transcripts — Safer Chatbots for Children",
    description: "Review chatbot transcripts for the Alliance and KORA.",
    url: `${KORA_PROJECT_PATH}/review`,
  });
}

function ReviewTool({
  state,
  onComplete,
}: {
  state: KoraReviewStateDto;
  onComplete: () => void;
}) {
  const assignment = state.assignment;
  const options = useMemo(
    (): KoraToolOptions | null =>
      assignment
        ? {
            reviewerId: state.reviewerId,
            assignment: {
              batchId: assignment.id,
              transcripts: assignment.transcripts.map((t) => ({
                transcript: parseKoraTranscript(t.transcript),
                contentHash: t.contentHash,
              })),
            },
            savedExport: assignment.savedExport
              ? parseKoraExport(assignment.savedExport)
              : null,
            collectProfile: state.collectProfile,
            collectExitSurvey: !assignment.extra,
            save: (exported) => saveKoraExport(assignment.id, { ...exported }),
          }
        : null,
    [assignment, state.reviewerId, state.collectProfile],
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
      {state.extraReviews > 0 && (
        <p>{REVIEW_COPY.extraReviews(state.extraReviews)}</p>
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
    <SiteRoot className="flex flex-col bg-white">
      <KoraNavbar hideNavLinks />
      <main
        aria-busy={busy || undefined}
        className="flex-1"
        style={{ paddingTop: NAV_HEIGHT }}
      >
        {children}
      </main>
    </SiteRoot>
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
    case KoraReviewPhase.Reviewing:
      return shell(
        <ReviewTool state={state} onComplete={() => void review.refresh()} />,
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
