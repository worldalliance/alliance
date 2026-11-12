import {
  KoraBatchEventKind,
  KoraProjectStatus,
  KoraReviewPhase,
  KoraReviewStatus,
} from "@alliance/common/kora";
import { R, type Result } from "@alliance/common/result";
import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { ValidateFunction } from "ajv/dist/2020";
import { DataSource, type EntityManager, In, IsNull, Not } from "typeorm";
import type {
  KoraLoadedAssignment,
  KoraReviewState,
} from "./dto/kora-review.dto";
import { KoraAssignmentTranscript } from "./entities/kora-assignment-transcript.entity";
import { KoraAssignment } from "./entities/kora-assignment.entity";
import { KoraBatchEvent } from "./entities/kora-batch-event.entity";
import { KoraBatch } from "./entities/kora-batch.entity";
import { KoraReviewer } from "./entities/kora-reviewer.entity";
import { KoraTranscript } from "./entities/kora-transcript.entity";
import { type Candidate, pickAssignment } from "./kora-assignment-pick";
import { KORA_MEMBER_REVIEWED, type KoraMemberReviewed } from "./kora-events";
import {
  checkExport,
  resultTranscriptIds,
  withoutResultsFor,
} from "./kora-export-check";
import { KoraProjectService } from "./kora-project.service";
import { redactExport } from "./kora-redact";
import { koraStagingTools } from "./kora-staging-tools";
import { koraAjv } from "./kora-upload";

export type KoraIdentity = { userId: number } | { participantId: string };

export enum KoraSaveError {
  NotFound = "not_found",
  Invalid = "invalid",
}

export type KoraSaveRefusal =
  | { error: KoraSaveError.NotFound }
  | { error: KoraSaveError.Invalid; reason: string };

export const KORA_RELEASE_AFTER_DAYS = 7;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;

@Injectable()
export class KoraReviewService {
  private readonly logger = new Logger(KoraReviewService.name);
  private readonly validators = new Map<string, ValidateFunction>();

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
      const anyAssignment = await manager.existsBy(KoraAssignment, {
        reviewerId: reviewer.id,
      });
      if (anyAssignment) {
        return this.summary(manager, reviewer, KoraReviewPhase.Finished);
      }
      if (status !== KoraProjectStatus.Active) {
        return this.summary(manager, reviewer, KoraReviewPhase.NotActive);
      }
      return this.assign(manager, reviewer, false);
    });
  }

  /** Starts an extra assignment once the last one is finished. */
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
      return this.assign(manager, reviewer, true);
    });
  }

  async save(params: {
    identity: KoraIdentity;
    assignmentId: string;
    exported: Record<string, unknown>;
  }): Promise<Result<{ completed: boolean }, KoraSaveRefusal>> {
    const reviewer = await this.reviewerFor(params.identity);
    const assignment = await this.dataSource.manager.findOneBy(KoraAssignment, {
      id: params.assignmentId,
      reviewerId: reviewer.id,
    });
    if (!assignment) return R.failure({ error: KoraSaveError.NotFound });
    const rows = await this.dataSource.manager.find(KoraAssignmentTranscript, {
      where: { assignmentId: assignment.id },
      relations: { transcript: true },
    });
    const exported = withoutResultsFor(
      params.exported,
      await this.droppedFrom(params.exported, rows),
    );
    const checked = checkExport({
      exported,
      validate: await this.validatorFor(assignment.schemaBatchId),
      reviewerId: reviewer.id,
      assignmentId: assignment.id,
      transcripts: rows.map((row) => ({
        id: row.transcriptId,
        contentHash: loadedTranscript(row).contentHash,
      })),
    });
    if (!checked.ok) {
      this.logger.warn(
        `Refused Kora export for assignment ${assignment.id}: it ${checked.error}`,
      );
      return R.failure({ error: KoraSaveError.Invalid, reason: checked.error });
    }
    const { statuses, profileAnswered } = checked.value;
    const completed = [...statuses.values()].every(
      (s) => s !== KoraReviewStatus.Pending,
    );
    await this.dataSource.transaction(async (manager) => {
      const now = new Date();
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
          { status },
        );
      }
      if (completed && assignment.completedAt === null && koraStagingTools()) {
        await manager.insert(KoraBatchEvent, {
          kind: KoraBatchEventKind.AssignmentCompleted,
          assignmentId: assignment.id,
          reviewerId: reviewer.id,
          ratingCount: [...statuses.values()].filter(
            (s) => s === KoraReviewStatus.Done,
          ).length,
        });
      }
      if (profileAnswered && !reviewer.profileAnsweredAt) {
        await manager.update(
          KoraReviewer,
          { id: reviewer.id },
          { profileAnsweredAt: now },
        );
      }
    });
    if (
      completed &&
      assignment.completedAt === null &&
      !assignment.extra &&
      reviewer.userId !== null
    ) {
      this.events.emit(KORA_MEMBER_REVIEWED, {
        userId: reviewer.userId,
      } satisfies KoraMemberReviewed);
    }
    return R.success({ completed });
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
   * Results for transcripts a retire or delete took out of the assignment,
   * which a reviewer whose tool loaded before it still sends.
   */
  private async droppedFrom(
    exported: Record<string, unknown>,
    rows: KoraAssignmentTranscript[],
  ): Promise<Set<string>> {
    const assigned = new Set(rows.map((row) => row.transcriptId));
    const unassigned = resultTranscriptIds(exported).filter(
      (id) => !assigned.has(id),
    );
    if (unassigned.length === 0) return new Set();
    const live = await this.dataSource.manager.find(KoraTranscript, {
      where: { id: In(unassigned), batch: { retiredAt: IsNull() } },
      select: { id: true },
    });
    const liveIds = new Set(live.map((t) => t.id));
    return new Set(unassigned.filter((id) => !liveIds.has(id)));
  }

  private unfinished(manager: EntityManager, reviewerId: string) {
    return manager.findOne(KoraAssignment, {
      where: { reviewerId, completedAt: IsNull() },
      order: { createdAt: "DESC" },
    });
  }

  private async validatorFor(batchId: string): Promise<ValidateFunction> {
    const cached = this.validators.get(batchId);
    if (cached) return cached;
    const batch = await this.dataSource.manager.findOneByOrFail(KoraBatch, {
      id: batchId,
    });
    const validate = koraAjv().compile(asRecord(batch.exportSchema) ?? {});
    this.validators.set(batchId, validate);
    return validate;
  }

  private async summary(
    manager: EntityManager,
    reviewer: KoraReviewer,
    phase: KoraReviewPhase,
  ): Promise<KoraReviewState> {
    const reviewed = await manager.existsBy(KoraAssignment, {
      reviewerId: reviewer.id,
      completedAt: Not(IsNull()),
    });
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
    const rows = await manager.find(KoraAssignmentTranscript, {
      where: { assignmentId: assignment.id },
      relations: { transcript: true },
      order: { position: "ASC" },
    });
    const loaded: KoraLoadedAssignment = {
      id: assignment.id,
      extra: assignment.extra,
      transcripts: rows.map(loadedTranscript),
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
    extra: boolean,
  ): Promise<KoraReviewState> {
    const newest = await manager.findOne(KoraBatch, {
      where: { retiredAt: IsNull() },
      order: { createdAt: "DESC" },
    });
    const candidates = newest
      ? await this.candidates(manager, reviewer.id)
      : [];
    const picked = newest
      ? pickAssignment({
          candidates,
          size: newest.transcriptsPerAssignment,
          random: Math.random,
        })
      : [];
    if (!newest || picked.length === 0) {
      return this.summary(manager, reviewer, KoraReviewPhase.NoneLeft);
    }
    const assignment = await manager.save(KoraAssignment, {
      reviewerId: reviewer.id,
      extra,
      schemaBatchId: newest.id,
      export: null,
      lastActivityAt: new Date(),
      completedAt: null,
    });
    await manager.insert(
      KoraAssignmentTranscript,
      picked.map((c, position) => ({
        assignmentId: assignment.id,
        transcriptId: c.id,
        position,
        status: KoraReviewStatus.Pending,
      })),
    );
    return this.reviewing(manager, reviewer, assignment);
  }

  /**
   * Transcripts this reviewer hasn't had, with how many reviews each still
   * needs: its target, less finished reviews, less pending ones in assignments
   * saved within the release window.
   */
  private async candidates(
    manager: EntityManager,
    reviewerId: string,
  ): Promise<Candidate[]> {
    const rows: { id: string; category: string; deficit: number }[] =
      await manager.query(
        `SELECT t."id", t."category",
           b."reviewsPerTranscript" - (
             SELECT COUNT(*)::int FROM "kora_assignment_transcript" at
             JOIN "kora_assignment" a ON a."id" = at."assignmentId"
             WHERE at."transcriptId" = t."id" AND a."deletedAt" IS NULL
               AND (at."status" = $2 OR (at."status" = $3
                 AND a."completedAt" IS NULL
                 AND a."lastActivityAt" > now() - make_interval(days => $4)))
           ) AS "deficit"
         FROM "kora_transcript" t
         JOIN "kora_batch" b ON b."id" = t."batchId"
         WHERE b."retiredAt" IS NULL AND NOT EXISTS (
           SELECT 1 FROM "kora_assignment_transcript" mine
           JOIN "kora_assignment" a ON a."id" = mine."assignmentId"
           WHERE mine."transcriptId" = t."id" AND a."reviewerId" = $1
             AND a."deletedAt" IS NULL
         )`,
        [
          reviewerId,
          KoraReviewStatus.Done,
          KoraReviewStatus.Pending,
          KORA_RELEASE_AFTER_DAYS,
        ],
      );
    return rows.filter((r) => r.deficit > 0);
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
