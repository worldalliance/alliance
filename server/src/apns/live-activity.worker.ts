import { ActionActivityType } from '@alliance/common/actionActivity';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ActionsService } from 'src/actions/actions.service';
import { ActionActivity } from 'src/actions/entities/action-activity.entity';
import { ActionStatus } from 'src/actions/entities/action-event.entity';
import {
  Action,
  parseAction,
  type ParsedAction,
} from 'src/actions/entities/action.entity';
import { LOCK_KEYS } from 'src/notifs/lock-keys';
import { withPgAdvisoryLock } from 'src/notifs/lock-utils';
import { UserDevice } from 'src/user/entities/user-device.entity';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { ApnsService } from './apns.service';
import { LiveActivityRegistration } from './entities/live-activity-registration.entity';

const [LOCK_KEY_1, LOCK_KEY_2] = LOCK_KEYS.liveActivity;
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

@Injectable()
export class LiveActivityWorker {
  private readonly logger = new Logger(LiveActivityWorker.name);

  constructor(
    @InjectRepository(LiveActivityRegistration)
    private readonly registrationRepository: Repository<LiveActivityRegistration>,
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(UserDevice)
    private readonly userDeviceRepository: Repository<UserDevice>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    private readonly apnsService: ApnsService,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => ActionsService))
    private readonly actionsService: ActionsService,
  ) {}

  // @Cron('*/3 * * * *')
  async handleCron(): Promise<void> {
    if (process.env.NODE_ENV !== 'production') return;

    await withPgAdvisoryLock(
      this.dataSource,
      LOCK_KEY_1,
      LOCK_KEY_2,
      async () => {
        await this.startLiveActivities();
        await this.endLiveActivities();
      },
    );
  }

  private async startLiveActivities(): Promise<void> {
    const now = new Date();
    const eightHoursFromNow = new Date(now.getTime() + EIGHT_HOURS_MS);

    // Find actions in MemberAction status with a deadline within 8 hours
    const actions = await this.actionRepository
      .find({
        relations: { events: true },
      })
      .then((rows) => rows.map(parseAction));

    // Only start if deadline is within 8 hours and hasn't passed
    const eligible: { action: ParsedAction; deadline: Date }[] = [];
    for (const action of actions) {
      if (action.status !== ActionStatus.MemberAction) continue;
      const deadline = action.memberActionPhase?.deadlineEvent?.date;
      if (!deadline) continue;
      if (deadline.getTime() > eightHoursFromNow.getTime()) continue;
      if (deadline.getTime() < now.getTime()) continue;
      eligible.push({ action, deadline });
    }

    // Find users who joined but haven't completed
    const joinedByAction =
      await this.actionsService.findParticipantIdsForActions(
        eligible.map((e) => e.action),
      );

    for (const { action, deadline } of eligible) {
      const joinedUserIds = joinedByAction.get(action.id) ?? [];
      const completedActivities = await this.actionActivityRepository.find({
        where: { actionId: action.id, type: ActionActivityType.USER_COMPLETED },
      });
      const completedUserIds = new Set(
        completedActivities.map((a) => a.userId),
      );

      for (const userId of joinedUserIds) {
        if (completedUserIds.has(userId)) continue;

        // Check if we already sent push-to-start for this user+action
        const existing = await this.registrationRepository.findOne({
          where: { userId, actionId: action.id, pushToStartSent: true },
        });
        if (existing) continue;

        // Get user devices with push-to-start tokens
        const devices = await this.userDeviceRepository.find({
          where: {
            user: { id: userId },
            liveActivityPushToStartToken: Not(IsNull()),
          },
        });

        for (const device of devices) {
          if (!device.liveActivityPushToStartToken) continue;

          try {
            const result = await this.apnsService.sendPushToStart(
              device.liveActivityPushToStartToken,
              {
                actionName: action.name,
                deadline: deadline.getTime() / 1000,
                totalCount: action.usersJoined,
              },
              {
                completedCount: action.usersCompleted,
              },
              {
                title: action.name,
                body: 'Action deadline approaching',
              },
            );

            if (result.statusCode === 200) {
              await this.registrationRepository.save(
                this.registrationRepository.create({
                  userId,
                  actionId: action.id,
                  pushToStartSent: true,
                  lastCompletedCountSent: action.usersCompleted,
                }),
              );
              this.logger.log(
                `Started LA for user ${userId}, action ${action.id}`,
              );
              break; // Only one device per user
            }
          } catch (err) {
            this.logger.error(
              `Failed push-to-start for user ${userId}, action ${action.id}`,
              err,
            );
          }
        }
      }
    }
  }

  private async endLiveActivities(): Promise<void> {
    const now = new Date();

    // Find registrations with update tokens that haven't been ended,
    // where the action deadline has passed
    const registrations = await this.registrationRepository.find({
      where: {
        ended: false,
        updateToken: Not(IsNull()),
      },
      relations: { action: { events: true } },
    });

    for (const reg of registrations) {
      const deadline = reg.action?.memberActionPhase?.deadlineEvent?.date;
      if (!deadline || deadline.getTime() > now.getTime()) continue;

      try {
        await this.apnsService.sendEnd(
          reg.updateToken!,
          { completedCount: reg.lastCompletedCountSent ?? 0 },
          Math.floor(now.getTime() / 1000) + 60, // dismiss after 1 minute
        );
        await this.registrationRepository.update(reg.id, { ended: true });
        this.logger.log(`Ended LA for registration ${reg.id}`);
      } catch (err) {
        this.logger.error(`Failed to end LA for registration ${reg.id}`, err);
      }
    }
  }
}
