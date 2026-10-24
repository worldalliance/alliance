import { countTaskBadge } from "@alliance/common/taskBadge";
import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { milliseconds } from "date-fns";
import { LOCK_KEYS } from "src/notifs/lock-keys";
import { withPgAdvisoryLock } from "src/notifs/lock-utils";
import { PushService } from "src/push/push.service";
import { UserDevice } from "src/user/entities/user-device.entity";
import {
  type AwayRangesChangedPayload,
  UserEvents,
} from "src/user/user.events";
import { DetachedWorkTracker } from "src/utils/detached-work";
import { notifDeliveryEnabled } from "src/utils/notif-delivery";
import {
  DataSource,
  In,
  IsNull,
  MoreThan,
  Not,
  type Repository,
} from "typeorm";
import { z } from "zod";
import { ActionsService } from "./actions.service";
import type { ActionActivityDto } from "./dto/action-activity.dto";

const [LOCK_KEY1, LOCK_KEY2] = LOCK_KEYS.taskBadgeSweep;
const SWEEP_INTERVAL_MS = milliseconds({ minutes: 1 });

type SweepSnapshot = { openActionIds: number[]; startedAt: Date };

const claimedDeviceSchema = z.object({
  id: z.string(),
  expoPushToken: z.string(),
  previousCount: z.number().nullable(),
});

/**
 * Keeps each signed-in device's app-icon badge at the user's task badge
 * count. The user's own changes sync immediately; everything else (admin
 * edits, deadlines, new tasks) is caught by the per-minute sweep.
 */
@Injectable()
export class TaskBadgeService implements OnModuleDestroy {
  private readonly logger = new Logger(TaskBadgeService.name);
  private readonly detachedWork = new DetachedWorkTracker();

  private readonly onActivity = (payload: {
    activity: Pick<ActionActivityDto, "user">;
  }) => this.syncDetached(payload.activity.user.id);

  private readonly onAwayRangesChanged = ({
    userId,
  }: AwayRangesChangedPayload) => this.syncDetached(userId);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly dataSource: DataSource,
    private readonly actionsService: ActionsService,
    private readonly pushService: PushService,
    @InjectRepository(UserDevice)
    private readonly userDeviceRepository: Repository<UserDevice>,
  ) {
    this.eventEmitter.on("action.activity", this.onActivity);
    this.eventEmitter.on(
      UserEvents.AwayRangesChanged,
      this.onAwayRangesChanged,
    );
  }

  async onModuleDestroy() {
    this.eventEmitter.off("action.activity", this.onActivity);
    this.eventEmitter.off(
      UserEvents.AwayRangesChanged,
      this.onAwayRangesChanged,
    );
    await this.detachedWork.drain();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async sweep() {
    if (!notifDeliveryEnabled()) {
      return;
    }
    const ran = await withPgAdvisoryLock(
      this.dataSource,
      LOCK_KEY1,
      LOCK_KEY2,
      async () => {
        const startedAt = new Date();
        const openActionIds = await this.actionsService.findOpenActionIds();
        const userIds = await this.findUserIdsWithDevices();
        for (const userId of userIds) {
          await this.syncUserLoggingFailure(userId, {
            openActionIds,
            startedAt,
          });
        }
        const elapsedMs = Date.now() - startedAt.getTime();
        if (elapsedMs > SWEEP_INTERVAL_MS) {
          this.logger.warn(
            `task badge sweep of ${userIds.length} users took ${elapsedMs}ms, longer than its interval`,
          );
        }
      },
    );
    if (ran === null) {
      this.logger.log("task badge sweep skipped bc of lock");
    }
  }

  private syncDetached(userId: number) {
    if (!notifDeliveryEnabled()) {
      return;
    }
    this.detachedWork.track(this.syncUserLoggingFailure(userId));
  }

  private syncUserLoggingFailure(
    userId: number,
    sweep?: SweepSnapshot,
  ): Promise<void> {
    return this.syncUser(userId, sweep).catch((error: unknown) =>
      this.logger.error(`Failed to sync task badge for user ${userId}`, error),
    );
  }

  /**
   * Sends the user's current count to each of their devices that last got a
   * different one. Device ownership is read at claim time, after the count,
   * so a device that changed accounts meanwhile is skipped. A sweep passes
   * the open actions it found once for every user, and the time it found
   * them, which is when the computation's inputs date from.
   */
  async syncUser(userId: number, sweep?: SweepSnapshot): Promise<void> {
    const startedAt = sweep?.startedAt ?? new Date();
    const hasDevice = await this.userDeviceRepository.exists({
      where: {
        user: { id: userId },
        expoPushToken: Not(IsNull()),
        taskBadgePushes: true,
      },
    });
    if (!hasDevice) {
      return;
    }
    const count = countTaskBadge(
      await this.actionsService.findMemberOpen({
        userId,
        openActionIds:
          sweep?.openActionIds ??
          (await this.actionsService.findOpenActionIds()),
      }),
      startedAt,
    );

    const claimed = z.array(claimedDeviceSchema).parse(
      (
        await this.userDeviceRepository.query(
          `WITH previous AS (
             SELECT id, "badgeCount" FROM user_device
             WHERE "userId" = $3 AND "expoPushToken" IS NOT NULL
               AND "taskBadgePushes" AND "deletedAt" IS NULL
             FOR UPDATE
           )
           UPDATE user_device device
           SET "badgeCount" = $1, "badgeCountComputedAt" = $2
           FROM previous
           WHERE previous.id = device.id
             AND (device."badgeCountComputedAt" IS NULL
               OR device."badgeCountComputedAt" < $2)
           RETURNING device.id, device."expoPushToken",
             previous."badgeCount" AS "previousCount"`,
          [count, startedAt, userId],
        )
      )[0],
    );
    const changed = claimed.filter((device) => device.previousCount !== count);
    if (changed.length === 0) {
      return;
    }

    const rejected = new Set(
      await this.pushService.sendTaskBadge({
        expoPushTokens: changed.map((device) => device.expoPushToken),
        count,
      }),
    );
    const failedIds = changed
      .filter((device) => rejected.has(device.expoPushToken))
      .map((device) => device.id);
    if (failedIds.length > 0) {
      // Unguarded: a newer sync that claimed the same count meanwhile sent
      // nothing, so the count it left is one the device never got.
      await this.userDeviceRepository.update(
        { id: In(failedIds) },
        { badgeCount: null },
      );
    }
    // A newer sync that claimed a different count sent its own push while
    // this one was in flight, and either may arrive last.
    await this.userDeviceRepository.update(
      {
        id: In(changed.map((device) => device.id)),
        badgeCountComputedAt: MoreThan(startedAt),
        badgeCount: Not(count),
      },
      { badgeCount: null },
    );
  }

  private async findUserIdsWithDevices(): Promise<number[]> {
    const rows = z.array(z.object({ userId: z.number() })).parse(
      await this.userDeviceRepository.query(
        `SELECT DISTINCT "userId" FROM user_device
           WHERE "expoPushToken" IS NOT NULL AND "taskBadgePushes"
             AND "deletedAt" IS NULL`,
      ),
    );
    return rows.map((row) => row.userId);
  }
}
