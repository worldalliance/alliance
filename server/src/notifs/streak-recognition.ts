import { BadRequestException } from "@nestjs/common";
import type { CreateReminderGroupDto } from "src/actions/dto/action.dto";
import { cohortNotifiesRecipientPersonally } from "src/actions/entities/reminder-group.entity";
import { StreakRecognitionCopy } from "./entities/action-event-notif.entity";
import { ExperimentArm } from "./entities/experiment-assignment.entity";
import {
  type ChannelTemplates,
  isMissedSuiteReminderGroup,
} from "./missed-suite-notice";

export const isStreakMilestone = (count: number): boolean =>
  count === 2 || count === 3 || (count > 0 && count % 5 === 0);

export function assertStreakRecognitionAllowed(
  dto: Pick<
    CreateReminderGroupDto,
    "cohortType" | "streakRecognition" | "emailSubject" | "emailMessage"
  >,
): void {
  if (!dto.streakRecognition) return;
  if (!cohortNotifiesRecipientPersonally(dto.cohortType)) {
    throw new BadRequestException(
      "streakRecognition is not supported for group-leads cohorts",
    );
  }
  if (isMissedSuiteReminderGroup(dto)) {
    throw new BadRequestException(
      "streakRecognition is not supported for missed-suite reminders",
    );
  }
}

export const STREAK_RECOGNITION_COPY: Record<
  ExperimentArm,
  StreakRecognitionCopy
> = {
  [ExperimentArm.Control]: StreakRecognitionCopy.Control,
  [ExperimentArm.Variant]: StreakRecognitionCopy.RecognitionV1,
};

export const STREAK_COPY_RECOGNIZES: Record<StreakRecognitionCopy, boolean> = {
  [StreakRecognitionCopy.Control]: false,
  [StreakRecognitionCopy.RecognitionV1]: true,
};

export function streakRecognitionTemplates(params: {
  copy: StreakRecognitionCopy;
  group: ChannelTemplates;
  streakCount: number;
}): ChannelTemplates {
  const { copy, group, streakCount } = params;
  switch (copy) {
    case StreakRecognitionCopy.Control:
      return group;
    case StreakRecognitionCopy.RecognitionV1: {
      const sentence = `You have completed ${streakCount} weeks of tasks in a row!`;
      return {
        pushMessage: `${sentence} ${group.pushMessage}`,
        textMessage: `${sentence} ${group.textMessage}`,
        emailSubject: sentence,
        emailMessage: group.emailMessage,
      };
    }
    default:
      throw new Error(
        `unknown streak-recognition copy: ${copy satisfies never}`,
      );
  }
}
