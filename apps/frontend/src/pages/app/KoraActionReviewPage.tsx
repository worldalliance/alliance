import { KORA_REVIEW_PATH, KoraReviewPhase } from "@alliance/common/kora";
import { KORA_ACTION_COPY } from "@alliance/shared/lib/koraAction";
import { queryKeys } from "@alliance/shared/lib/queryKeys";
import { cn } from "@alliance/shared/styles/util";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router";
import { z } from "zod";
import { REVIEW_COPY } from "../../components/projects/safer-chatbots-for-children-26/copy";
import { KoraAssignmentReview } from "../../components/projects/safer-chatbots-for-children-26/KoraReviewTool";
import { useKoraActionReview } from "../../components/projects/safer-chatbots-for-children-26/useKoraReview";
import { useAuth } from "../../lib/AuthContext";
import { useKoraActiveTime } from "../../lib/useKoraActiveTime";
import { SiteRoot } from "../../site/PageShell";
import { SITE_COL } from "../../site/ui";

/** A Kora review action's review, without the Kora project's navigation, so the mobile app can show it too. */
export default function KoraActionReviewPage() {
  const actionId = z.coerce.number().int().parse(useParams().id);
  const auth = useAuth();
  const queryClient = useQueryClient();
  const query = useKoraActionReview(actionId, auth.isAuthenticated);
  useKoraActiveTime(query.data?.assignment?.id ?? null);
  const actionPath = `/actions/${actionId}`;

  const shell = (children: ReactNode, busy = false) => (
    <SiteRoot className="flex flex-col bg-white">
      <header className="border-b border-zinc-200 px-5 py-2">
        <Link
          to={actionPath}
          className="inline-flex min-h-11 items-center gap-2 font-medium"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {KORA_ACTION_COPY.backToAction}
        </Link>
      </header>
      <main aria-busy={busy || undefined} className="flex flex-1 flex-col">
        {children}
      </main>
    </SiteRoot>
  );
  const done = (children: ReactNode) =>
    shell(
      <section className={cn(SITE_COL, "flex max-w-2xl flex-col gap-3 py-12")}>
        {children}
      </section>,
    );

  if (auth.loading) return shell(null, true);
  if (!auth.isAuthenticated) return <Navigate to={actionPath} replace />;
  if (query.isPending) return shell(null, true);
  if (query.isError) {
    return shell(
      <p role="alert" className={cn(SITE_COL, "py-10 text-red-700")}>
        {REVIEW_COPY.loadFailed}
      </p>,
    );
  }
  const state = query.data;
  const phase = z.enum(KoraReviewPhase).parse(state.phase);
  switch (phase) {
    case KoraReviewPhase.Reviewing:
      return shell(
        <KoraAssignmentReview
          state={state}
          onComplete={() =>
            void queryClient.invalidateQueries({
              queryKey: queryKeys.koraActionReview(actionId),
            })
          }
        />,
      );
    case KoraReviewPhase.Finished:
      return done(
        <>
          <h1 className="text-2xl font-semibold">
            {KORA_ACTION_COPY.completeHeading}
          </h1>
          <p>{KORA_ACTION_COPY.continueNote}</p>
          <Link
            to={KORA_REVIEW_PATH}
            className="inline-flex min-h-11 items-center self-start rounded-lg bg-black px-5 font-medium text-white"
          >
            {KORA_ACTION_COPY.reviewMore}
          </Link>
        </>,
      );
    case KoraReviewPhase.NoneLeft:
    case KoraReviewPhase.NotActive:
      return done(<p role="status">{KORA_ACTION_COPY.noneLeft}</p>);
    default:
      throw new Error(`unknown phase: ${phase satisfies never}`);
  }
}
