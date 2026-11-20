import {
  KoraProjectStatus,
  KoraReviewPhase,
  KoraReviewStatus,
} from "@alliance/common/kora";
import { R, type Result } from "@alliance/common/result";
import { exportSchema } from "@alliance/kora-review/schemas";
import type { KoraExport } from "@alliance/kora-review/types";
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
import type {
  KoraLoadedAssignment,
  KoraReviewState,
} from "./dto/kora-review.dto";
import { KoraAssignmentTranscript } from "./entities/kora-assignment-transcript.entity";
import { KoraAssignment } from "./entities/kora-assignment.entity";
import { KoraBatch } from "./entities/kora-batch.entity";
import { KoraReviewer } from "./entities/kora-reviewer.entity";
import { KoraTranscript } from "./entities/kora-transcript.entity";
import {
  completionOf,
  emitMemberReviewed,
  type KoraCompletion,
  logCompletion,
} from "./kora-completion";
import {
  changedResults,
  checkExport,
  resultTranscriptIds,
  withoutResultsFor,
} from "./kora-export-check";
import {
  type KoraAssignmentProgress,
  type KoraHome,
  koraHome,
  type KoraOffer,
} from "./kora-home";
import {
  bindNext,
  candidates,
  earliestClose,
  heldRows,
  newestOpenBatch,
  releaseExpired,
} from "./kora-pool";
import { KoraProjectService } from "./kora-project.service";
import { redactExport } from "./kora-redact";
import { koraAjv, storedTranscript } from "./kora-upload";

export type KoraIdentity = { userId: number } | { participantId: string };

export enum KoraSaveError {
  NotFound = "not_found",
  Invalid = "invalid",
}

export type KoraSaved = { completed: boolean; removed: string[] };

export type KoraSaveRefusal =
  | { error: KoraSaveError.NotFound }
  | { error: KoraSaveError.Invalid; reason: string };

const validExport = koraAjv().compile<KoraExport>(exportSchema);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;

@Injectable()
export class KoraReviewService {
  private readonly logger = new Logger(KoraReviewService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly projectService: KoraProjectService,
    private readonly events: EventEmitter2,
  ) {}

  async state(identity: KoraIdentity): Promise<KoraReviewState> {
    const reviewer = await this.reviewerFor(identity);
    const status = (await this.projectService.project()).status;
    return this.dataSource.transaction(async (manager) => {
      await lockReviewer(manager, reviewer.id);
      const unfinished = await this.unfinished(manager, reviewer.id);
      if (unfinished) return this.reviewing(manager, reviewer, unfinished);
      if (await this.hasCompleted(manager, reviewer.id)) {
        return this.summary(manager, reviewer, KoraReviewPhase.Finished);
      }
      if (status !== KoraProjectStatus.Active) {
        return this.summary(manager, reviewer, KoraReviewPhase.NotActive);
      }
      return this.assign(manager, reviewer);
    });
  }

  /** Starts another assignment once none is open. */
  async more(identity: KoraIdentity): Promise<KoraReviewState> {
    const reviewer = await this.reviewerFor(identity);
    const status = (await this.projectService.project()).status;
    return this.dataSource.transaction(async (manager) => {
      await lockReviewer(manager, reviewer.id);
      const unfinished = await this.unfinished(manager, reviewer.id);
      if (unfinished) return this.reviewing(manager, reviewer, unfinished);
      if (status !== KoraProjectStatus.Active) {
        return this.summary(manager, reviewer, KoraReviewPhase.NoneLeft);
      }
      return this.assign(manager, reviewer);
    });
  }

  /** Reads only: an offer reserves nothing until `more` starts it. */
  async home(identity: KoraIdentity): Promise<KoraHome> {
    const reviewer = await this.reviewerFor(identity);
    const manager = this.dataSource.manager;
    const status = (await this.projectService.project()).status;
    const assignments = await this.progress(manager, reviewer.id);
    const offer =
      status === KoraProjectStatus.Active
        ? await this.offer(manager, reviewer.id)
        : null;
    return koraHome({ now: new Date(), assignments, offer });
  }

  async save(params: {
    identity: KoraIdentity;
    assignmentId: string;
    exported: Record<string, unknown>;
  }): Promise<Result<KoraSaved, KoraSaveRefusal>> {
    const reviewer = await this.reviewerFor(params.identity);
    const outcome = await this.dataSource.transaction(async (manager) => {
      await lockReviewer(manager, reviewer.id);
      const assignment = await manager.findOneBy(KoraAssignment, {
        id: params.assignmentId,
        reviewerId: reviewer.id,
      });
      if (!assignment) {
        return R.failure<KoraSaveRefusal>({ error: KoraSaveError.NotFound });
      }
      await releaseExpired(manager, assignment.id);
      const held = await heldRows(manager, assignment.id);
      const { removed, dropped } = await this.droppedFrom(manager, {
        exported: params.exported,
        assignmentId: assignment.id,
        held,
      });
      const exported = withoutResultsFor(params.exported, dropped);
      const checked = checkExport({
        exported,
        validate: validExport,
        reviewerId: reviewer.id,
        assignmentId: assignment.id,
        transcripts: held.map((row) => {
          const transcript = loadedTranscript(row);
          return {
            id: row.transcriptId,
            contentHash: transcript.contentHash,
            conversation: storedTranscript(transcript).conversation,
          };
        }),
      });
      if (!checked.ok) {
        this.logger.warn(
          `Refused Kora export for assignment ${assignment.id}: it ${checked.error}`,
        );
        return R.failure<KoraSaveRefusal>({
          error: KoraSaveError.Invalid,
          reason: checked.error,
        });
      }
      const { statuses, profileAnswered, optOutCategories } = checked.value;
      const size = await this.sizeOf(manager, assignment);
      const completed =
        assignment.completedAt !== null ||
        (held.length >= size &&
          [...statuses.values()].every((s) => s !== KoraReviewStatus.Pending));
      const completion =
        completed && assignment.completedAt === null
          ? completionOf({ assignment, reviewer, statuses: statuses.values() })
          : null;
      const now = new Date();
      const changed = changedResults(assignment.export, exported);
      await manager.update(
        KoraAssignment,
        { id: assignment.id },
        {
          export: redactExport(exported),
          lastActivityAt: now,
          completedAt: completed ? (assignment.completedAt ?? now) : null,
        },
      );
      for (const [transcriptId, status] of statuses) {
        await manager.update(
          KoraAssignmentTranscript,
          { assignmentId: assignment.id, transcriptId },
          changed.has(transcriptId)
            ? { status, lastActivityAt: now }
            : { status },
        );
      }
      if (completion) await logCompletion(manager, completion);
      if (optOutCategories.length > 0) {
        await manager.query(
          `UPDATE "kora_reviewer" SET "optOutCategories" = ARRAY(
             SELECT DISTINCT unnest("optOutCategories" || $2::text[]) ORDER BY 1
           ) WHERE "id" = $1`,
          [reviewer.id, optOutCategories],
        );
      }
      if (profileAnswered && !reviewer.profileAnsweredAt) {
        await manager.update(
          KoraReviewer,
          { id: reviewer.id },
          { profileAnsweredAt: now },
        );
      }
      return R.success({ saved: { completed, removed }, completion });
    });
    if (!outcome.ok) return outcome;
    if (outcome.value.completion) {
      emitMemberReviewed(this.events, outcome.value.completion);
    }
    return R.success(outcome.value.saved);
  }

  /**
   * Gives the reviewer their next transcript in the assignment, or null once
   * it is full or nothing is left to give, which finishes it.
   */
  async next(params: {
    identity: KoraIdentity;
    assignmentId: string;
  }): Promise<Result<KoraTranscript | null, KoraSaveError.NotFound>> {
    const reviewer = await this.reviewerFor(params.identity);
    const outcome = await this.dataSource.transaction(async (manager) => {
      await lockReviewer(manager, reviewer.id);
      const assignment = await manager.findOneBy(KoraAssignment, {
        id: params.assignmentId,
        reviewerId: reviewer.id,
      });
      if (!assignment) return null;
      if (assignment.completedAt) return { transcript: null, completion: null };
      const transcript = await bindNext(manager, {
        assignment,
        size: await this.sizeOf(manager, assignment),
      });
      const completion = transcript
        ? null
        : await this.finish(manager, { assignment, reviewer });
      return { transcript, completion };
    });
    if (!outcome) return R.failure(KoraSaveError.NotFound);
    if (outcome.completion) emitMemberReviewed(this.events, outcome.completion);
    return R.success(outcome.transcript);
  }

  /**
   * Marks an assignment with nothing more to give finished, once none of its
   * transcripts is pending. Only one that holds a transcript credits the
   * member, as finishing it themselves would.
   */
  private async finish(
    manager: EntityManager,
    params: { assignment: KoraAssignment; reviewer: KoraReviewer },
  ): Promise<KoraCompletion | null> {
    const held = await heldRows(manager, params.assignment.id);
    if (held.some((r) => r.status === KoraReviewStatus.Pending)) return null;
    await manager.update(
      KoraAssignment,
      { id: params.assignment.id },
      { completedAt: new Date() },
    );
    const completion = completionOf({
      ...params,
      statuses: held.map((r) => r.status),
    });
    await logCompletion(manager, completion);
    return held.length > 0 ? completion : null;
  }

  private async sizeOf(
    manager: EntityManager,
    assignment: KoraAssignment,
  ): Promise<number> {
    const batch = await manager.findOneByOrFail(KoraBatch, {
      id: assignment.schemaBatchId,
    });
    return batch.transcriptsPerAssignment;
  }

  private async reviewerFor(identity: KoraIdentity): Promise<KoraReviewer> {
    const manager = this.dataSource.manager;
    await manager
      .createQueryBuilder()
      .insert()
      .into(KoraReviewer)
      // A copy, because the insert writes the generated columns back into it.
      .values({ ...identity })
      .orIgnore()
      .execute();
    return manager.findOneByOrFail(KoraReviewer, identity);
  }

  /**
   * Results to drop for transcripts no longer in the assignment, released or
   * taken out by a retire or delete, which a tool loaded before still sends.
   * The save reports them so the tool swaps them.
   */
  private async droppedFrom(
    manager: EntityManager,
    params: {
      exported: Record<string, unknown>;
      assignmentId: string;
      held: KoraAssignmentTranscript[];
    },
  ): Promise<{ removed: string[]; dropped: Set<string> }> {
    const heldIds = new Set(params.held.map((row) => row.transcriptId));
    const unheld = resultTranscriptIds(params.exported).filter(
      (id) => !heldIds.has(id),
    );
    if (unheld.length === 0) return { removed: [], dropped: new Set() };
    const releasedRows = await manager.find(KoraAssignmentTranscript, {
      where: {
        assignmentId: params.assignmentId,
        transcriptId: In(unheld),
        status: KoraReviewStatus.Released,
      },
      select: { transcriptId: true },
    });
    const released = releasedRows.map((r) => r.transcriptId);
    const live = await manager.find(KoraTranscript, {
      where: { id: In(unheld), batch: { retiredAt: IsNull() } },
      select: { id: true },
    });
    const liveIds = new Set(live.map((t) => t.id));
    const dropped = new Set([
      ...released,
      ...unheld.filter((id) => !liveIds.has(id)),
    ]);
    return { removed: [...dropped], dropped };
  }

  private unfinished(manager: EntityManager, reviewerId: string) {
    const open = { reviewerId, completedAt: IsNull() };
    return manager.findOne(KoraAssignment, {
      where: [
        { ...open, closesAt: IsNull() },
        { ...open, closesAt: MoreThan(new Date()) },
      ],
      order: { createdAt: "DESC" },
    });
  }

  private hasCompleted(manager: EntityManager, reviewerId: string) {
    return manager.existsBy(KoraAssignment, {
      reviewerId,
      completedAt: Not(IsNull()),
    });
  }

  private async summary(
    manager: EntityManager,
    reviewer: KoraReviewer,
    phase: KoraReviewPhase,
  ): Promise<KoraReviewState> {
    const reviewed = await this.hasCompleted(manager, reviewer.id);
    const extraReviews = await manager
      .createQueryBuilder(KoraAssignmentTranscript, "at")
      .innerJoin(KoraAssignment, "a", `a.id = at."assignmentId"`)
      .where(
        `a."reviewerId" = :reviewerId AND a.extra AND a."deletedAt" IS NULL`,
        {
          reviewerId: reviewer.id,
        },
      )
      .andWhere("at.status = :done", { done: KoraReviewStatus.Done })
      .getCount();
    return {
      phase,
      reviewerId: reviewer.id,
      collectProfile: reviewer.profileAnsweredAt === null,
      optOutCategories: reviewer.optOutCategories,
      reviewed,
      extraReviews,
      assignment: null,
    };
  }

  private async reviewing(
    manager: EntityManager,
    reviewer: KoraReviewer,
    assignment: KoraAssignment,
  ): Promise<KoraReviewState> {
    const size = await this.sizeOf(manager, assignment);
    await bindNext(manager, { assignment, size });
    const held = await heldRows(manager, assignment.id);
    if (held.length === 0) {
      await this.finish(manager, { assignment, reviewer });
      return this.summary(manager, reviewer, KoraReviewPhase.NoneLeft);
    }
    const loaded: KoraLoadedAssignment = {
      id: assignment.id,
      extra: assignment.extra,
      size,
      transcripts: held.map(loadedTranscript),
      savedExport: asRecord(assignment.export),
    };
    return {
      ...(await this.summary(manager, reviewer, KoraReviewPhase.Reviewing)),
      assignment: loaded,
    };
  }

  private async assign(
    manager: EntityManager,
    reviewer: KoraReviewer,
  ): Promise<KoraReviewState> {
    const newest = await newestOpenBatch(manager);
    const available = newest ? await candidates(manager, reviewer.id) : [];
    if (!newest || available.length === 0) {
      return this.summary(manager, reviewer, KoraReviewPhase.NoneLeft);
    }
    const assignment = await manager.save(KoraAssignment, {
      reviewerId: reviewer.id,
      extra: await this.hasCompleted(manager, reviewer.id),
      schemaBatchId: newest.id,
      export: null,
      lastActivityAt: new Date(),
      closesAt: earliestClose(available),
      completedAt: null,
    });
    return this.reviewing(manager, reviewer, assignment);
  }

  private async offer(
    manager: EntityManager,
    reviewerId: string,
  ): Promise<KoraOffer | null> {
    const newest = await newestOpenBatch(manager);
    if (!newest) return null;
    const available = await candidates(manager, reviewerId);
    if (available.length === 0) return null;
    return {
      releasedAt: newest.createdAt,
      closesAt: earliestClose(available),
      size: Math.min(newest.transcriptsPerAssignment, available.length),
    };
  }

  private async progress(
    manager: EntityManager,
    reviewerId: string,
  ): Promise<KoraAssignmentProgress[]> {
    return manager.query(
      `SELECT a."id", a."createdAt", a."closesAt", a."completedAt",
         MAX(b."createdAt") AS "releasedAt",
         CASE WHEN a."completedAt" IS NULL THEN MAX(sb."transcriptsPerAssignment")
           ELSE COUNT(at."transcriptId") FILTER (WHERE at."status" <> $4) END::int AS "total",
         COUNT(at."transcriptId") FILTER (WHERE at."status" NOT IN ($2, $4))::int AS "progress",
         COUNT(at."transcriptId") FILTER (WHERE at."status" = $3)::int AS "ranked"
       FROM "kora_assignment" a
       JOIN "kora_batch" sb ON sb."id" = a."schemaBatchId"
       LEFT JOIN "kora_assignment_transcript" at ON at."assignmentId" = a."id"
       LEFT JOIN "kora_transcript" t ON t."id" = at."transcriptId"
       LEFT JOIN "kora_batch" b ON b."id" = t."batchId"
       WHERE a."reviewerId" = $1 AND a."deletedAt" IS NULL
       GROUP BY a."id"`,
      [
        reviewerId,
        KoraReviewStatus.Pending,
        KoraReviewStatus.Done,
        KoraReviewStatus.Released,
      ],
    );
  }
}
function loadedTranscript(row: KoraAssignmentTranscript): KoraTranscript {
  if (!row.transcript) {
    throw new Error(`transcript ${row.transcriptId} wasn't loaded`);
  }
  return row.transcript;
}

async function lockReviewer(
  manager: EntityManager,
  reviewerId: string,
): Promise<void> {
  await manager.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
    `kora-reviewer:${reviewerId}`,
  ]);
}
