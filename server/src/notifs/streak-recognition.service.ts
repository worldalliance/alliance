import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { completedSuiteStreak } from "src/actions/completed-suite-streak";
import { cohortNotifiesRecipientPersonally } from "src/actions/entities/reminder-group.entity";
import type { SuiteOutcome } from "src/actions/missed-suite-streak";
import type { Repository } from "typeorm";
import type { NotificationPlan } from "./dto/notification-plan.dto";
import {
  ActionEventNotif,
  type StreakRecognitionCopy,
} from "./entities/action-event-notif.entity";
import {
  Experiment,
  ExperimentAssignment,
} from "./entities/experiment-assignment.entity";
import { assignExperimentArm } from "./experiment-assignment";
import {
  isStreakMilestone,
  STREAK_RECOGNITION_COPY,
} from "./streak-recognition";

export type StreakRecognition = {
  count: number;
  runSuiteId: number;
  copy: StreakRecognitionCopy;
};

@Injectable()
export class StreakRecognitionService {
  constructor(
    @InjectRepository(ActionEventNotif)
    private readonly actionEventNotifsRepository: Repository<ActionEventNotif>,
    @InjectRepository(ExperimentAssignment)
    private readonly experimentAssignmentRepository: Repository<ExperimentAssignment>,
  ) {}

  /**
   * The milestone this reminder is the first to reach for its member, or null
   * to send it as usual. Both arms claim the milestone, so a control member's
   * later reminders stay comparable with a variant member's.
   */
  async resolve(
    plan: NotificationPlan,
    closedSuites: SuiteOutcome[],
  ): Promise<StreakRecognition | null> {
    if (
      !plan.group.streakRecognition ||
      !cohortNotifiesRecipientPersonally(plan.group.cohortType)
    ) {
      return null;
    }
    const { count, runSuiteId } = completedSuiteStreak(
      closedSuites,
      plan.user.id,
    );
    if (runSuiteId === null || !isStreakMilestone(count)) return null;
    const alreadyReached = await this.actionEventNotifsRepository.existsBy({
      user: { id: plan.user.id },
      streakRunSuiteId: runSuiteId,
      streakCount: count,
    });
    if (alreadyReached) return null;
    const arm = await assignExperimentArm(
      this.experimentAssignmentRepository.manager,
      { experiment: Experiment.StreakRecognition, userId: plan.user.id },
    );
    return { count, runSuiteId, copy: STREAK_RECOGNITION_COPY[arm] };
  }
}
