import {
  recognitionCopy,
  recognitionCopySchema,
} from "@alliance/common/action-update-copy";
import { displayOnlyMarkdown } from "@alliance/common/forms/display-only-markdown";
import { readDisplayOnlySchema } from "@alliance/common/forms/display-only-schema";
import { R, type Result } from "@alliance/common/result";
import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { chunk } from "es-toolkit";
import { MessageSource } from "src/link-tracking/message-tracking.entity";
import type { TrackedMessage } from "src/link-tracking/message-tracking.service";
import { MailService } from "src/mail/mail.service";
import { MmsService } from "src/mms/mms.service";
import { externalChannels } from "src/notification-settings/external-channels";
import { NotificationKind } from "src/notification-settings/notification-kind";
import {
  NotificationPreferencesService,
  type Preferences,
} from "src/notification-settings/notification-preferences.service";
import {
  UnreadContent,
  UnreadContentType,
} from "src/notifs/entities/unread-content.entity";
import { NotificationChannel } from "src/notifs/notif-utils";
import { NotifsService } from "src/notifs/notifs.service";
import { PushService } from "src/push/push.service";
import { actionUrl } from "src/search/approutes";
import { User } from "src/user/entities/user.entity";
import { textReachable } from "src/user/user.utils";
import { DataSource, In, Raw, type EntityManager } from "typeorm";
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import {
  findLatestCompletions,
  TERMINAL_ACTIVITY_TYPES,
} from "./action-activity-status";
import { ActionParticipantsService } from "./action-participants.service";
import { actionUpdateEmailHtml } from "./action-update-email";
import {
  planRecognition,
  readRecognitionConfig,
  usesRecognition,
  type RecognitionPlan,
} from "./action-update-recognition";
import { actionUpdateEntrySendTime } from "./action-update-visibility";
import { ActionActivity } from "./entities/action-activity.entity";
import { ActionUpdateExposure } from "./entities/action-update-exposure.entity";
import {
  ActionUpdate,
  ActionUpdateNotificationMode,
  lockActionUpdateRow,
} from "./entities/action-update.entity";

const DELIVERY_BATCH = 200;

const anyOf = (ids: readonly number[]) =>
  Raw((column) => `${column} = ANY(:ids)`, { ids });

@Injectable()
export class ActionUpdateRecognitionService {
  private readonly logger = new Logger(ActionUpdateRecognitionService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly notifsService: NotifsService,
    private readonly mailService: MailService,
    private readonly mmsService: MmsService,
    private readonly pushService: PushService,
    private readonly participants: ActionParticipantsService,
    private readonly preferences: NotificationPreferencesService,
  ) {}

  async participantIdsOf(actionId: number): Promise<Set<number>> {
    return new Set(
      await this.participants.findParticipantIdsForActionById(actionId),
    );
  }

  async plan(params: {
    em: EntityManager;
    update: ActionUpdate;
    userIds: readonly number[];
    participantIds: ReadonlySet<number>;
  }): Promise<Result<RecognitionPlan[], string>> {
    const { em, update, userIds, participantIds } = params;
    const results = readRecognitionConfig(update);
    if (!results.ok) return results;

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
    });
    const completedIds = new Set(
      findLatestCompletions(terminal).map((completion) => completion.userId),
    );
    return R.success(
      planRecognition({
        results: results.value,
        recipients: users.map((user) => ({
          userId: user.id,
          name: user.name,
          completed: completedIds.has(user.id),
          participant: participantIds.has(user.id),
        })),
      }),
    );
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
  async prepare(id: number, now: Date): Promise<Result<void, string>> {
    // Read on its own pool connections, so it runs before the transaction
    // rather than while holding one.
    const participantIds = await this.participantIdsOf(
      (await this.dataSource.manager.findOneByOrFail(ActionUpdate, { id }))
        .actionId,
    );
    const held = await this.dataSource.transaction(
      async (em): Promise<string | null> => {
        await lockActionUpdateRow(em, id);
        const update = await em.findOneOrFail(ActionUpdate, {
          where: { id },
          relations: { action: { project: true }, schemaSnapshot: true },
        });
        if (
          !update.notifiedAt ||
          update.recognitionPreparedAt ||
          !usesRecognition(update.notificationMode) ||
          actionUpdateEntrySendTime(update) > now
        ) {
          return null;
        }
        const exposures = await em.find(ActionUpdateExposure, {
          where: { actionUpdateId: id },
        });
        const hold = async (reason: string) => {
          await em.update(ActionUpdate, id, { notificationHeldReason: reason });
          return reason;
        };
        const content = readDisplayOnlySchema(update.schemaSnapshot?.schema);
        if (!content) return hold("The update's content can't be read.");
        const planned = await this.plan({
          em,
          update,
          userIds: exposures.map((exposure) => exposure.userId),
          participantIds,
        });
        if (!planned.ok) return hold(planned.error);

        if (!update.action) {
          throw new Error(`action update ${id} loaded without its action`);
        }
        const link = actionUrl(update.actionId, true);
        const projectOrActionName =
          update.action.project?.name ?? update.action.name;
        const contentMarkdown = displayOnlyMarkdown({
          blocks: content.blocks,
          videoLink: link,
        });
        const prepared = planned.value.map((plan) => ({
          plan,
          copy: recognitionCopy({
            allianceResult: plan.allianceResult,
            recipientName: plan.name,
            link,
            projectOrActionName,
            content: contentMarkdown,
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
              completed: plan.completed,
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
        const plannedIds = new Set(planned.value.map((plan) => plan.userId));
        const skippedIds = exposures
          .filter((exposure) => !plannedIds.has(exposure.userId))
          .map((exposure) => exposure.id);
        if (skippedIds.length) {
          await em
            .createQueryBuilder()
            .softDelete()
            .from(ActionUpdateExposure)
            .where("id = ANY(:ids)", { ids: skippedIds })
            .execute();
        }
        await em.update(ActionUpdate, id, {
          recognitionPreparedAt: now,
          notificationHeldReason: null,
        });
        return null;
      },
    );
    if (held === null) return R.success(undefined);

    this.logger.warn(`holding action update ${id}: ${held}`);
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
          AND "deletedAt" IS NULL
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
    const preferences = await this.preferences.load({
      userIds: exposures.map((exposure) => exposure.userId),
      kinds: [NotificationKind.ActionUpdates],
    });
    for (const exposure of exposures) {
      // A batch can outlast its 10-minute claim; skip a row another run retook
      // or a deletion marked since the claim.
      const [renewed]: [unknown[], number] = await this.dataSource.query(
        `
        UPDATE action_update_exposure SET "deliveryClaimedAt" = now()
        WHERE id = $1 AND "deliveryClaimedAt" = $2::timestamptz
          AND "deletedAt" IS NULL
        RETURNING id
        `,
        [exposure.id, claimed[0].claimedAt],
      );
      if (!renewed.length) continue;
      // A failure stays claimed until the claim expires, then retries alone.
      await this.deliver({ exposure, shownEntries, preferences }).catch(
        (error: unknown) =>
          this.logger.error(
            `delivering action update exposure ${exposure.id} failed`,
            error,
          ),
      );
    }
    return claimed.length === DELIVERY_BATCH;
  }

  private async deliver(params: {
    exposure: ActionUpdateExposure;
    shownEntries: ReadonlyMap<number, UnreadContent>;
    preferences: Preferences;
  }) {
    const { exposure, shownEntries, preferences } = params;
    const { user, actionUpdate } = exposure;
    if (!user || !actionUpdate) {
      throw new Error(`exposure ${exposure.id} loaded without its relations`);
    }
    // A recipient who can no longer access the inbox entry gets no external
    // channel either; one who hid it by setting still does.
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
      const channels = externalChannels({
        user,
        kind: NotificationKind.ActionUpdates,
        preferences,
      });
      if (channels.includes(NotificationChannel.Push)) {
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
        channels.includes(NotificationChannel.Text) &&
        textReachable(user)
      ) {
        const mms = await this.mmsService.sendMms({
          to: user.phoneNumber,
          userId: user.id,
          body: copy.sms,
          mediaUrls: [],
          tracking,
        });
        await record(mms ? { mms } : { textFailedAt: new Date() });
      }
      if (
        !exposure.mail &&
        exposure.emailFailedAt === null &&
        channels.includes(NotificationChannel.Email)
      ) {
        const mail = await R.fromPromise(
          this.mailService.sendCustomHtmlEmail({
            subject: copy.emailSubject,
            html: actionUpdateEmailHtml(copy.emailBody),
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
