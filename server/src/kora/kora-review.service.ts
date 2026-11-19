import {
  KORA_SESSION_BUDGET_UNITS,
  KoraProjectStatus,
  KoraReviewPhase,
  KoraReviewStatus,
  KoraSessionEnd,
} from "@alliance/common/kora";
import { R, type Result } from "@alliance/common/result";
import { exportSchema } from "@alliance/kora-review/schemas";
import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  DataSource,
  type EntityManager,
  In,
  IsNull,
  MoreThan,
  Not,
} from "typeorm";
import type { KoraLoadedSession, KoraReviewState } from "./dto/kora-review.dto";
import { KoraConversation } from "./entities/kora-conversation.entity";
import type { ParsedKoraReviewer } from "./entities/kora-reviewer.entity";
import { KoraSessionConversation } from "./entities/kora-session-conversation.entity";
import { KoraSession } from "./entities/kora-session.entity";
import {
  completionOf,
  emitMemberReviewed,
  logCompletion,
} from "./kora-completion";
import {
  changedRatings,
  checkExport,
  ratedConversationIds,
  withoutRatingsFor,
} from "./kora-export-check";
import {
  type KoraHome,
  koraHome,
  type KoraOffer,
  type KoraSessionProgress,
} from "./kora-home";
import { attentionPass, koraItem, storedConversation } from "./kora-item";
import { KoraProjectService } from "./kora-project.service";
import {
  type Candidate,
  earliestClose,
  heldConversation,
  heldRows,
  newestOpenBatch,
  pickNext,
  releaseExpired,
} from "./kora-queue";
import { redactExport } from "./kora-redact";
import {
  type KoraNextResult,
  ratedCandidates,
  serveNext,
} from "./kora-review-allocation";
import {
  type KoraIdentity,
  type KoraOnboarding,
  KoraReviewerService,
} from "./kora-reviewer.service";
import { koraAjv } from "./kora-upload";

export enum KoraSaveError {
  NotFound = "not_found",
  Invalid = "invalid",
}

export type { KoraNextResult } from "./kora-review-allocation";

export type KoraSaved = { ended: boolean; removed: string[] };

export type KoraSaveRefusal =
  | { error: KoraSaveError.NotFound }
  | { error: KoraSaveError.Invalid; reason: string };

const validExport = koraAjv().compile(exportSchema);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;

/** No session is served before the reviewer has consented and passed the sign-up screens. */
const onboardingOf = (reviewer: ParsedKoraReviewer): KoraOnboarding => ({
  demographics: reviewer.demographics,
  consentAt: reviewer.consentAt,
  onboardedAt: reviewer.onboardedAt,
});

const onboarded = (reviewer: ParsedKoraReviewer): boolean =>
  Boolean(reviewer.consentAt && reviewer.onboardedAt);

@Injectable()
export class KoraReviewService {
  private readonly logger = new Logger(KoraReviewService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly projectService: KoraProjectService,
    private readonly events: EventEmitter2,
    private readonly reviewers: KoraReviewerService,
  ) {}

  async state(identity: KoraIdentity): Promise<KoraReviewState> {
    const reviewer = await this.reviewers.reviewerFor(identity);
    const status = (await this.projectService.project()).status;
    return this.dataSource.transaction(async (manager) => {
      await lockReviewer(manager, reviewer.id);
      const open = await this.openSession(manager, reviewer.id);
      if (open) return this.reviewing(manager, reviewer, open);
      if (await this.hasEnded(manager, reviewer.id)) {
        return this.summary(manager, reviewer, KoraReviewPhase.Finished);
      }
      if (status !== KoraProjectStatus.Active) {
        return this.summary(manager, reviewer, KoraReviewPhase.NotActive);
      }
      if (!onboarded(reviewer)) {
        return this.summary(manager, reviewer, KoraReviewPhase.Onboarding);
      }
      return this.start(manager, reviewer);
    });
  }

  /** Starts another session once none is open. */
  async more(identity: KoraIdentity): Promise<KoraReviewState> {
    const reviewer = await this.reviewers.reviewerFor(identity);
    const status = (await this.projectService.project()).status;
    return this.dataSource.transaction(async (manager) => {
      await lockReviewer(manager, reviewer.id);
      const open = await this.openSession(manager, reviewer.id);
      if (open) return this.reviewing(manager, reviewer, open);
      if (status !== KoraProjectStatus.Active) {
        return this.summary(manager, reviewer, KoraReviewPhase.NoneLeft);
      }
      if (!onboarded(reviewer)) {
        return this.summary(manager, reviewer, KoraReviewPhase.Onboarding);
      }
      return this.start(manager, reviewer);
    });
  }

  /** Reads only: an offer reserves nothing until `more` starts a session. */
  async home(identity: KoraIdentity): Promise<KoraHome> {
    const reviewer = await this.reviewers.reviewerFor(identity);
    const manager = this.dataSource.manager;
    const status = (await this.projectService.project()).status;
    const sessions = await this.progress(manager, reviewer.id);
    const offer =
      status === KoraProjectStatus.Active
        ? await this.offer(manager, reviewer)
        : null;
    return koraHome({ now: new Date(), sessions, offer });
  }

  /** The conversation the reviewer should see next, reserved for them. */
  async next(params: {
    identity: KoraIdentity;
    sessionId: string;
  }): Promise<Result<KoraNextResult, KoraSaveError>> {
    const reviewer = await this.reviewers.reviewerFor(params.identity);
    return this.dataSource.transaction(async (manager) => {
      await lockReviewer(manager, reviewer.id);
      const session = await manager.findOneBy(KoraSession, {
        id: params.sessionId,
        reviewerId: reviewer.id,
        deletedAt: IsNull(),
      });
      if (!session) {
        return R.failure<KoraSaveError>(KoraSaveError.NotFound);
      }
      if (session.endedAt) {
        return R.success<KoraNextResult>({ done: KoraSessionEnd.BudgetSpent });
      }
      return R.success(await serveNext(manager, { session, reviewer }));
    });
  }

  async save(params: {
    identity: KoraIdentity;
    sessionId: string;
    exported: Record<string, unknown>;
  }): Promise<Result<KoraSaved, KoraSaveRefusal>> {
    const reviewer = await this.reviewers.reviewerFor(params.identity);
    const outcome = await this.dataSource.transaction(async (manager) => {
      await lockReviewer(manager, reviewer.id);
      const session = await manager.findOneBy(KoraSession, {
        id: params.sessionId,
        reviewerId: reviewer.id,
        deletedAt: IsNull(),
      });
      if (!session) {
        return R.failure<KoraSaveRefusal>({ error: KoraSaveError.NotFound });
      }
      await releaseExpired(manager, session.id);
      const held = await heldRows(manager, session.id);
      const { removed, dropped } = await this.droppedFrom(manager, {
        exported: params.exported,
        sessionId: session.id,
        held,
      });
      const exported = withoutRatingsFor(params.exported, dropped);
      const checked = checkExport({
        exported,
        validate: validExport,
        reviewerId: reviewer.id,
        sessionId: session.id,
        conversations: held.map((row) => ({
          id: row.conversationId,
          contentHash: heldConversation(row).contentHash,
        })),
      });
      if (!checked.ok) {
        this.logger.warn(
          `Refused Kora export for session ${session.id}: it ${checked.error}`,
        );
        return R.failure<KoraSaveRefusal>({
          error: KoraSaveError.Invalid,
          reason: checked.error,
        });
      }
      const { statuses } = checked.value;
      const ended = exported.isDone === true;
      const now = new Date();
      const changed = changedRatings(session.export, exported);
      await manager.update(
        KoraSession,
        { id: session.id },
        {
          export: redactExport(exported),
          lastActivityAt: now,
          endedAt: ended ? (session.endedAt ?? now) : null,
        },
      );
      for (const [conversationId, status] of statuses) {
        await manager.update(
          KoraSessionConversation,
          { sessionId: session.id, conversationId },
          {
            status,
            ...(changed.has(conversationId) && { lastActivityAt: now }),
            ...(status === KoraReviewStatus.Done && {
              attentionPass: attentionOf(held, exported, conversationId),
            }),
          },
        );
      }
      const completion =
        ended && session.endedAt === null
          ? completionOf({ session, reviewer, statuses: statuses.values() })
          : null;
      if (completion) await logCompletion(manager, completion);
      return R.success({ saved: { ended, removed }, completion });
    });
    if (!outcome.ok) return outcome;
    if (outcome.value.completion) {
      emitMemberReviewed(this.events, outcome.value.completion);
    }
    return R.success(outcome.value.saved);
  }

  /**
   * Ratings to drop for conversations no longer in the session, released or taken out by a retire or
   * a delete, which a tool loaded before still sends. The save reports them so the tool drops them.
   */
  private async droppedFrom(
    manager: EntityManager,
    params: {
      exported: Record<string, unknown>;
      sessionId: string;
      held: KoraSessionConversation[];
    },
  ): Promise<{ removed: string[]; dropped: Set<string> }> {
    const heldIds = new Set(params.held.map((row) => row.conversationId));
    const unheld = ratedConversationIds(params.exported).filter(
      (id) => !heldIds.has(id),
    );
    if (unheld.length === 0) return { removed: [], dropped: new Set() };
    const releasedRows = await manager.find(KoraSessionConversation, {
      where: {
        sessionId: params.sessionId,
        conversationId: In(unheld),
        status: KoraReviewStatus.Released,
      },
      select: { conversationId: true },
    });
    const released = releasedRows.map((r) => r.conversationId);
    const live = await manager.find(KoraConversation, {
      where: { id: In(unheld), batch: { retiredAt: IsNull() } },
      select: { id: true },
    });
    const liveIds = new Set(live.map((c) => c.id));
    const dropped = new Set([
      ...released,
      ...unheld.filter((id) => !liveIds.has(id)),
    ]);
    return { removed: [...dropped], dropped };
  }

  /** A session past its closing date can't be continued, so the reviewer starts another. */
  private openSession(manager: EntityManager, reviewerId: string) {
    const open = { reviewerId, endedAt: IsNull(), deletedAt: IsNull() };
    return manager.findOne(KoraSession, {
      where: [
        { ...open, closesAt: IsNull() },
        { ...open, closesAt: MoreThan(new Date()) },
      ],
      order: { createdAt: "DESC" },
    });
  }

  private hasEnded(manager: EntityManager, reviewerId: string) {
    return manager.existsBy(KoraSession, {
      reviewerId,
      endedAt: Not(IsNull()),
    });
  }

  private async summary(
    manager: EntityManager,
    reviewer: ParsedKoraReviewer,
    phase: KoraReviewPhase,
  ): Promise<KoraReviewState> {
    const sessionsCompleted = await manager.countBy(KoraSession, {
      reviewerId: reviewer.id,
      endedAt: Not(IsNull()),
      deletedAt: IsNull(),
    });
    const ratingsCompleted = await manager
      .createQueryBuilder(KoraSessionConversation, "sc")
      .innerJoin(KoraSession, "s", `s.id = sc."sessionId"`)
      .where(`s."reviewerId" = :reviewerId AND s."deletedAt" IS NULL`, {
        reviewerId: reviewer.id,
      })
      .andWhere("sc.status = :done", { done: KoraReviewStatus.Done })
      .getCount();
    return {
      phase,
      reviewerId: reviewer.id,
      optOutRisks: reviewer.optOutCategories,
      extendedOptIn: reviewer.extendedOptIn,
      reviewed: sessionsCompleted > 0,
      sessionsCompleted,
      ratingsCompleted,
      onboarding: onboardingOf(reviewer),
      session: null,
    };
  }

  private async reviewing(
    manager: EntityManager,
    reviewer: ParsedKoraReviewer,
    session: KoraSession,
  ): Promise<KoraReviewState> {
    // The tool mounts with what the session already holds, so a new one is given its first
    // conversation here rather than leaving the reviewer to ask for it.
    const serving = await serveNext(manager, { session, reviewer });
    const held = await heldRows(manager, session.id);
    if (held.length === 0 && "done" in serving) {
      return this.summary(manager, reviewer, KoraReviewPhase.NoneLeft);
    }
    const loaded: KoraLoadedSession = {
      id: session.id,
      number: session.number,
      budgetUnits: session.budgetUnits,
      items: held.map((row) =>
        koraItem({
          conversation: heldConversation(row),
          ratedPosition: row.ratedPosition,
          firstTimeOnRisk: row.firstTimeOnRisk,
        }),
      ),
      savedExport: asRecord(session.export),
    };
    return {
      ...(await this.summary(manager, reviewer, KoraReviewPhase.Reviewing)),
      session: loaded,
    };
  }

  private async start(
    manager: EntityManager,
    reviewer: ParsedKoraReviewer,
  ): Promise<KoraReviewState> {
    const newest = await newestOpenBatch(manager);
    const available = newest ? await ratedCandidates(manager, reviewer) : [];
    if (!newest || !servable(available)) {
      return this.summary(manager, reviewer, KoraReviewPhase.NoneLeft);
    }
    const number =
      (await manager.countBy(KoraSession, {
        reviewerId: reviewer.id,
        deletedAt: IsNull(),
      })) + 1;
    const session = await manager.save(KoraSession, {
      reviewerId: reviewer.id,
      number,
      budgetUnits: KORA_SESSION_BUDGET_UNITS,
      schemaBatchId: newest.id,
      export: null,
      lastActivityAt: new Date(),
      closesAt: earliestClose(available),
      endedAt: null,
    });
    return this.reviewing(manager, reviewer, session);
  }

  private async offer(
    manager: EntityManager,
    reviewer: ParsedKoraReviewer,
  ): Promise<KoraOffer | null> {
    const newest = await newestOpenBatch(manager);
    if (!newest) return null;
    const available = await ratedCandidates(manager, reviewer);
    if (!servable(available)) return null;
    return {
      releasedAt: newest.createdAt,
      closesAt: earliestClose(available),
    };
  }

  private async progress(
    manager: EntityManager,
    reviewerId: string,
  ): Promise<KoraSessionProgress[]> {
    return manager.query(
      `SELECT s."id", s."createdAt", s."closesAt", s."endedAt",
         MAX(b."createdAt") AS "releasedAt",
         COUNT(sc."conversationId") FILTER (WHERE sc."status" <> $4)::int AS "total",
         COUNT(sc."conversationId") FILTER (WHERE sc."status" NOT IN ($2, $4))::int AS "progress",
         COUNT(sc."conversationId") FILTER (WHERE sc."status" = $3)::int AS "ranked"
       FROM "kora_session" s
       LEFT JOIN "kora_session_conversation" sc ON sc."sessionId" = s."id"
       LEFT JOIN "kora_conversation" c ON c."id" = sc."conversationId"
       LEFT JOIN "kora_batch" b ON b."id" = c."batchId"
       WHERE s."reviewerId" = $1 AND s."deletedAt" IS NULL
       GROUP BY s."id"`,
      [
        reviewerId,
        KoraReviewStatus.Pending,
        KoraReviewStatus.Done,
        KoraReviewStatus.Released,
      ],
    );
  }
}

/** Whether the queue would serve any of these, which is what an offer and a new session rest on. */
const servable = (available: Candidate[]): boolean =>
  pickNext({ candidates: available, seenRisks: new Set(), random: () => 0 }) !==
  null;

/** The attention conversation's verdict against the reference the import carries (spec 6.0 section 8). */
function attentionOf(
  held: KoraSessionConversation[],
  exported: Record<string, unknown>,
  conversationId: string,
): boolean | null {
  const row = held.find((r) => r.conversationId === conversationId);
  if (!row) return null;
  const ratings = Array.isArray(exported.ratings) ? exported.ratings : [];
  const rating = ratings
    .map((r: unknown) => asRecord(r))
    .find((r) => r && r.conversationId === conversationId);
  if (!rating) return null;
  return attentionPass({
    stored: storedConversation(row),
    verdict: rating.q1,
  });
}

async function lockReviewer(
  manager: EntityManager,
  reviewerId: string,
): Promise<void> {
  await manager.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
    `kora-reviewer:${reviewerId}`,
  ]);
}
