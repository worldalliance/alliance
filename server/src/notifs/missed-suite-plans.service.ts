import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ActionsService } from "src/actions/actions.service";
import type { SuiteOutcome } from "src/actions/missed-suite-streak";
import { In, type Repository } from "typeorm";
import {
  NotificationPlan,
  PreviewNotificationPlanDto,
} from "./dto/notification-plan.dto";
import { ActionEventNotif } from "./entities/action-event-notif.entity";
import {
  getsMissedSuiteNotice,
  isMissedSuiteReminderGroup,
  missedSuiteNoticeKey,
  MissedSuitePlanKind,
  resolveMissedSuitePlan,
} from "./missed-suite-notice";

@Injectable()
export class MissedSuitePlanService {
  constructor(
    private readonly actionsService: ActionsService,
    @InjectRepository(ActionEventNotif)
    private readonly actionEventNotifsRepository: Repository<ActionEventNotif>,
  ) {}

  // Plan-time dedupe sees only this group's sent notifs, so unsent claims and
  // sibling groups on the suite re-plan the member every cycle of the window.
  async dropClaimedPlans(
    plans: NotificationPlan[],
  ): Promise<NotificationPlan[]> {
    const keyOf = (plan: NotificationPlan) =>
      isMissedSuiteReminderGroup(plan.group) && plan.group.actionSuite
        ? missedSuiteNoticeKey(plan.group.actionSuite.id, plan.user.id)
        : null;
    const keys = plans.flatMap((plan) => keyOf(plan) ?? []);
    if (keys.length === 0) return plans;
    const claimed = new Set(
      (
        await this.actionEventNotifsRepository.find({
          where: { idempotency_key: In(keys) },
          select: { idempotency_key: true },
        })
      ).map((notif) => notif.idempotency_key),
    );
    return plans.filter((plan) => !claimed.has(keyOf(plan)));
  }

  async findClosedSuitesFor(
    plans: NotificationPlan[],
    now: Date,
  ): Promise<SuiteOutcome[]> {
    return plans.some((plan) => isMissedSuiteReminderGroup(plan.group))
      ? this.actionsService.findClosedSuiteOutcomes(now)
      : [];
  }

  /**
   * Once a missed-suite group's suite has closed, keeps only the members
   * dispatch would notify, with their miss number. Before then every plan
   * stays. A missed-suite group with no suite never sends, so it has none.
   */
  async toPreview(
    plans: NotificationPlan[],
  ): Promise<PreviewNotificationPlanDto[]> {
    const closedSuites = await this.findClosedSuitesFor(plans, new Date());
    return (await this.dropClaimedPlans(plans)).flatMap((plan) => {
      const resolution = resolveMissedSuitePlan({
        group: plan.group,
        userId: plan.user.id,
        closedSuites,
      });
      switch (resolution.kind) {
        case MissedSuitePlanKind.Ordinary:
        case MissedSuitePlanKind.SuiteOpen:
          return [new PreviewNotificationPlanDto({ plan, missNumber: null })];
        case MissedSuitePlanKind.NoSuite:
          return [];
        case MissedSuitePlanKind.Due:
          return getsMissedSuiteNotice(resolution.standing)
            ? [
                new PreviewNotificationPlanDto({
                  plan,
                  missNumber: resolution.standing.missNumber,
                }),
              ]
            : [];
        default:
          throw new Error(
            `unknown missed-suite plan kind: ${resolution satisfies never}`,
          );
      }
    });
  }
}
