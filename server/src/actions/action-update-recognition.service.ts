import { ActionActivityType } from "@alliance/common/actionActivity";
import {
  CONTRIBUTION_FORMULA_KEY,
  contributionFormulaSchema,
  type ContributionFormulaMode,
} from "@alliance/common/forms/contribution-formula";
import { R, type Result } from "@alliance/common/result";
import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { chunk, escape, uniq } from "es-toolkit";
import { MessageSource } from "src/link-tracking/message-tracking.entity";
import type { TrackedMessage } from "src/link-tracking/message-tracking.service";
import { MailService } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
import { Experiment } from "src/notifs/entities/experiment-assignment.entity";
import {
  UnreadContent,
  UnreadContentType,
} from "src/notifs/entities/unread-content.entity";
import { assignExperimentArms } from "src/notifs/experiment-assignment";
import { NotifsService } from "src/notifs/notifs.service";
import { PushService } from "src/push/push.service";
import { actionUrl } from "src/search/approutes";
import { FormSnapshot } from "src/tasks/entities/formsnapshot.entity";
import { User } from "src/user/entities/user.entity";
import {
  userActionNotifsEnabled_email,
  userActionNotifsEnabled_text,
} from "src/user/user.utils";
import { DataSource, In, Raw, type EntityManager } from "typeorm";
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import {
  findLatestTerminalActivity,
  TERMINAL_ACTIVITY_TYPES,
} from "./action-activity-status";
import {
  collectiveEmailSubject,
  planRecognition,
  readRecognitionConfig,
  recognitionCopy,
  recognitionModeOf,
  type RecognitionMemberIssue,
  type RecognitionPlan,
} from "./action-update-recognition";
import { actionUpdateEntrySendTime } from "./action-update-visibility";
import type { RecognitionCheckDtoArgs } from "./dto/action-update-recognition.dto";
import { ActionActivity } from "./entities/action-activity.entity";
import {
  ActionUpdateExposure,
  recognitionCopySchema,
} from "./entities/action-update-exposure.entity";
import {
  ActionUpdate,
  ActionUpdateNotificationMode,
  lockActionUpdateRow,
} from "./entities/action-update.entity";

export type RecognitionCheck = {
  problems: string[];
  members: RecognitionMemberIssue[];
};

const DELIVERY_BATCH = 200;

const anyOf = (ids: readonly number[]) =>
  Raw((column) => `${column} = ANY(:ids)`, { ids });

export function describeRecognitionCheck(check: RecognitionCheck): string {
  const memberProblem =
    check.members.length === 0
      ? []
      : [
          `The contribution doesn't resolve for ${check.members.length} member${check.members.length === 1 ? "" : "s"} who would see it; check the recognition copy to see who.`,
        ];
  return [...check.problems, ...memberProblem].join(" ");
}

/** Drafts may save a formula that doesn't compile yet, but not a malformed one. */
export function assertContributionFormulasWritable(
  formulas: Partial<
    Record<(typeof CONTRIBUTION_FORMULA_KEY)[ContributionFormulaMode], unknown>
  >,
) {
  for (const formula of Object.values(CONTRIBUTION_FORMULA_KEY).map(
    (key) => formulas[key],
  )) {
    if (formula === undefined || formula === null) continue;
    const parsed = contributionFormulaSchema.safeParse(formula);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map((issue) => issue.message).join("; "),
      );
    }
  }
}

@Injectable()
export class ActionUpdateRecognitionService {
  private readonly logger = new Logger(ActionUpdateRecognitionService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notifsService: NotifsService,
    private readonly mailService: MailService,
    private readonly mmsService: MmsService,
    private readonly pushService: PushService,
  ) {}

  /** Draws the experiment arm of any recipient who has none yet. */
  async plan(params: {
    em: EntityManager;
    update: ActionUpdate;
    userIds: readonly number[];
    now: Date;
  }): Promise<Result<RecognitionPlan[], RecognitionCheck>> {
    const { em, update, userIds, now } = params;
    const config = readRecognitionConfig(update);
    if (!config.ok) {
      return R.failure({ problems: config.error, members: [] });
    }

    const users = await em.find(User, {
      where: { id: anyOf(userIds) },
      select: { id: true, name: true },
    });
    const terminal = await em.find(ActionActivity, {
      where: {
        actionId: update.actionId,
        type: In(TERMINAL_ACTIVITY_TYPES),
        userId: anyOf(userIds),
      },
      relations: { taskFormResponse: true },
    });
    // A later withdrawal retracts a completion, as everywhere status is read.
    const completions = [
      ...Map.groupBy(terminal, (activity) => activity.userId).values(),
    ].flatMap((activities) => {
      const latest = findLatestTerminalActivity(activities);
      return latest?.type === ActionActivityType.USER_COMPLETED ? [latest] : [];
    });
    // A whole action shares a few snapshots, so each schema loads once.
    const snapshotIds = uniq(
      completions.flatMap((completion) =>
        completion.taskFormResponse
          ? [completion.taskFormResponse.formSnapshotId]
          : [],
      ),
    );
    const schemaBySnapshot = new Map(
      (
        await em.find(FormSnapshot, {
          where: { id: anyOf(snapshotIds) },
          select: { id: true, schema: true },
        })
      ).map((snapshot) => [snapshot.id, snapshot.schema]),
    );
    const arms = await assignExperimentArms(em, {
      experiment: Experiment.ActionUpdateRecognition,
      userIds,
    });

    const completionByUser = new Map(
      completions.map((completion) => [completion.userId, completion]),
    );
    const planned = planRecognition({
      config: config.value,
      now,
      recipients: users.map((user) => {
        const arm = arms.get(user.id);
        if (arm === undefined) {
          throw new Error(`no recognition arm for user ${user.id}`);
        }
        const completion = completionByUser.get(user.id);
        const response = completion?.taskFormResponse;
        return {
          userId: user.id,
          name: user.name,
          arm,
          completion: completion
            ? {
                completedAt: completion.createdAt,
                response: response
                  ? {
                      answers: response.answers,
                      schema: schemaBySnapshot.get(response.formSnapshotId),
                    }
                  : null,
              }
            : null,
        };
      }),
    });
    return planned.ok
      ? planned
      : R.failure({ problems: [], members: planned.error });
  }

  async check(params: {
    update: ActionUpdate;
    userIds: readonly number[];
  }): Promise<RecognitionCheck> {
    const planned = await this.plan({
      ...params,
      em: this.dataSource.manager,
      now: new Date(),
    });
    return planned.ok ? { problems: [], members: [] } : planned.error;
  }

  /** Who a send would block on now, once sent what holds it, and nothing once its copy is frozen. */
  async checkForAdmin(params: {
    update: ActionUpdate;
    recipientIds: () => Promise<number[]>;
  }): Promise<RecognitionCheckDtoArgs> {
    const { update } = params;
    const collectiveSubject = collectiveEmailSubject(update.shortNotifString);
    if (update.recognitionPreparedAt) {
      return { problems: [], members: [], collectiveSubject };
    }
    const userIds = update.notifiedAt
      ? (
          await this.dataSource.manager.find(ActionUpdateExposure, {
            where: { actionUpdateId: update.id },
            select: { userId: true },
          })
        ).map((exposure) => exposure.userId)
      : await params.recipientIds();
    return {
      ...(await this.check({ update, userIds })),
      collectiveSubject,
    };
  }

  async recordAudience(params: {
    em: EntityManager;
    actionUpdateId: number;
    userIds: readonly number[];
  }) {
    const { em, actionUpdateId, userIds } = params;
    await em.save(
      ActionUpdateExposure,
      userIds.map((userId) =>
        em.create(ActionUpdateExposure, { actionUpdateId, userId }),
      ),
      { chunk: 1000 },
    );
  }

  async prepareDue(now: Date) {
    const pending = await this.dataSource.manager
      .createQueryBuilder(ActionUpdate, "update")
      .where('update."notifiedAt" IS NOT NULL')
      .andWhere('update."recognitionPreparedAt" IS NULL')
      .andWhere('update."notificationMode" <> :legacy', {
        legacy: ActionUpdateNotificationMode.Legacy,
      })
      .orderBy("update.id")
      .getMany();
    for (const update of pending) {
      if (actionUpdateEntrySendTime(update) <= now) {
        // A failure retries next minute without holding up the updates after it.
        await this.prepare(update.id, now).catch((error: unknown) =>
          this.logger.error(
            `preparing action update ${update.id} failed`,
            error,
          ),
        );
      }
    }
  }

  /**
   * Freezes every recipient's copy and creates the inbox entries in one
   * transaction, or holds the whole update when any recipient's copy fails.
   */
  async prepare(
    id: number,
    now: Date,
  ): Promise<Result<void, RecognitionCheck>> {
    const held = await this.dataSource.transaction(
      async (em): Promise<RecognitionCheck | null> => {
        await lockActionUpdateRow(em, id);
        const update = await em.findOneByOrFail(ActionUpdate, { id });
        if (
          !update.notifiedAt ||
          update.recognitionPreparedAt ||
          recognitionModeOf(update.notificationMode) === null ||
          actionUpdateEntrySendTime(update) > now
        ) {
          return null;
        }
        const exposures = await em.find(ActionUpdateExposure, {
          where: { actionUpdateId: id },
        });
        const planned = await this.plan({
          em,
          update,
          userIds: exposures.map((exposure) => exposure.userId),
          now,
        });
        if (!planned.ok) {
          await em.update(ActionUpdate, id, {
            notificationHeldReason: describeRecognitionCheck(planned.error),
          });
          return planned.error;
        }

        const prepared = planned.value.map((plan) => ({
          plan,
          copy: recognitionCopy({
            message: plan.message,
            recipientName: plan.name,
            link: actionUrl(update.actionId, true),
          }),
        }));
        const entries = await this.notifsService.sendUnreadContents(
          prepared.map(({ plan, copy }) => ({
            user: { id: plan.userId },
            contentType: UnreadContentType.ActionUpdate,
            contentId: id,
            fixedText: copy.inApp,
            sendTime: now,
            shouldPush: false,
          })),
          em,
        );
        const frozen = prepared.map(
          ({ plan, copy }, index) =>
            ({
              actionUpdateId: id,
              userId: plan.userId,
              mode: update.notificationMode,
              assignedArm: plan.arm,
              completed: plan.completed,
              branch: plan.message.branch,
              contribution: plan.contribution,
              weeksAgo: plan.weeksAgo,
              copy,
              preparedAt: now,
              unreadContentId: entries[index].id,
            }) satisfies QueryDeepPartialEntity<ActionUpdateExposure>,
        );
        // One statement per batch, not per recipient, while the row lock is held.
        for (const batch of chunk(frozen, 1000)) {
          await em.upsert(ActionUpdateExposure, batch, [
            "actionUpdateId",
            "userId",
          ]);
        }
        await em.update(ActionUpdate, id, {
          recognitionPreparedAt: now,
          notificationHeldReason: null,
        });
        return null;
      },
    );
    if (held === null) return R.success(undefined);

    this.logger.warn(
      `holding action update ${id}: ${describeRecognitionCheck(held)}`,
    );
    return R.failure(held);
  }

  /** Sends one batch; true while more may be waiting. */
  async deliverPrepared(): Promise<boolean> {
    const [claimed]: [{ id: number; claimedAt: string }[], number] =
      await this.dataSource.query(
        `
      WITH cte AS (
        SELECT id FROM action_update_exposure
        WHERE "preparedAt" IS NOT NULL
          AND "deliveredAt" IS NULL
          AND (
            "deliveryClaimedAt" IS NULL
            OR "deliveryClaimedAt" < now() - interval '10 minutes'
          )
        ORDER BY id
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE action_update_exposure exposure
      SET "deliveryClaimedAt" = now()
      FROM cte
      WHERE exposure.id = cte.id
      RETURNING exposure.id, exposure."deliveryClaimedAt"::text AS "claimedAt"
      `,
        [DELIVERY_BATCH],
      );
    if (!claimed.length) return false;

    const exposures = await this.dataSource.manager.find(ActionUpdateExposure, {
      where: { id: anyOf(claimed.map((row) => row.id)) },
      relations: {
        user: { contractEvents: true },
        actionUpdate: true,
        mail: true,
        mms: true,
      },
      order: { id: "ASC" },
    });
    const shownEntries = new Map(
      (
        await this.notifsService.getUnreadContentsForPush(
          exposures.flatMap((exposure) => exposure.unreadContentId ?? []),
        )
      ).map(({ unreadContent }) => [unreadContent.id, unreadContent]),
    );
    for (const exposure of exposures) {
      // A batch can outlast its 10-minute claim; skip a row another run retook.
      const [renewed]: [unknown[], number] = await this.dataSource.query(
        `
        UPDATE action_update_exposure SET "deliveryClaimedAt" = now()
        WHERE id = $1 AND "deliveryClaimedAt" = $2::timestamptz
        RETURNING id
        `,
        [exposure.id, claimed[0].claimedAt],
      );
      if (!renewed.length) continue;
      // A failure stays claimed until the claim expires, then retries alone.
      await this.deliver(exposure, shownEntries).catch((error: unknown) =>
        this.logger.error(
          `delivering action update exposure ${exposure.id} failed`,
          error,
        ),
      );
    }
    return claimed.length === DELIVERY_BATCH;
  }

  private async deliver(
    exposure: ActionUpdateExposure,
    shownEntries: ReadonlyMap<number, UnreadContent>,
  ) {
    const { user, actionUpdate } = exposure;
    if (!user || !actionUpdate) {
      throw new Error(`exposure ${exposure.id} loaded without its relations`);
    }
    // A recipient who can't see the inbox entry gets no external channel either.
    const entry =
      exposure.unreadContentId === null
        ? undefined
        : shownEntries.get(exposure.unreadContentId);
    // A claim left by a crash is retaken; channels it already sent are skipped.
    const record = (sent: QueryDeepPartialEntity<ActionUpdateExposure>) =>
      this.dataSource.manager.update(ActionUpdateExposure, exposure.id, sent);
    if (entry && exposure.copy !== null) {
      const copy = recognitionCopySchema.parse(exposure.copy);
      const tracking: TrackedMessage = {
        owner: { userId: user.id },
        source: MessageSource.ActionUpdate,
        context: {
          actionId: actionUpdate.actionId,
          actionUpdateId: actionUpdate.id,
        },
        actionEventNotifId: null,
      };
      if (user.pushesForActionUpdates) {
        await this.pushService.sendMessages(
          await this.pushService.getPushForAllUserDevices(user.id, {
            userId: user.id,
            body: copy.push,
            screen: actionUrl(actionUpdate.actionId),
            unreadContent: entry,
            idempotencyKey: `uc-${entry.id}`,
          }),
        );
      }
      // A failed text or email is final; a retaken claim doesn't resend it.
      if (
        !exposure.mms &&
        exposure.textFailedAt === null &&
        user.phoneNumber !== null &&
        userActionNotifsEnabled_text(user)
      ) {
        const mms = await this.mmsService.sendMms({
          to: user.phoneNumber,
          body: copy.sms,
          mediaUrls: [],
          tracking,
        });
        await record(mms ? { mms } : { textFailedAt: new Date() });
      }
      if (
        !exposure.mail &&
        exposure.emailFailedAt === null &&
        userActionNotifsEnabled_email(user)
      ) {
        const mail = await R.fromPromise(
          this.mailService.sendActionEventNotificationEmail({
            subject: copy.emailSubject,
            message: escape(copy.emailBody),
            tracking,
            recipient: user.email,
          }),
        );
        if (mail.ok) {
          await record({ mail: mail.value });
        } else {
          this.logger.error(
            `emailing action update exposure ${exposure.id} failed`,
            mail.error,
          );
          await record({ emailFailedAt: new Date() });
        }
      }
    }
    const deliveredAt = new Date();
    await record(
      entry ? { deliveredAt } : { deliveredAt, hiddenAt: deliveredAt },
    );
  }
}
