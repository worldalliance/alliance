import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { Experiment } from "src/notifs/entities/experiment-assignment.entity";
import { readExperimentArms } from "src/notifs/experiment-assignment";
import { DataSource, In, Raw } from "typeorm";
import {
  findLatestCompletions,
  TERMINAL_ACTIVITY_TYPES,
} from "./action-activity-status";
import { ActionParticipantsService } from "./action-participants.service";
import {
  countRecognitionPreview,
  type RecognitionPreviewCounts,
} from "./action-update-recognition";
import { ActionActivity } from "./entities/action-activity.entity";

@Injectable()
export class ActionUpdateRecognitionPreviewService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly participants: ActionParticipantsService,
  ) {}

  /** Reads arms and the saved roster without drawing or deciding anything. */
  async counts(params: {
    actionId: number;
    userIds: readonly number[];
  }): Promise<RecognitionPreviewCounts> {
    const { actionId, userIds } = params;
    const em = this.dataSource.manager;
    const terminal = await em.find(ActionActivity, {
      where: {
        actionId,
        type: In(TERMINAL_ACTIVITY_TYPES),
        userId: Raw((column) => `${column} = ANY(:ids)`, { ids: userIds }),
      },
    });
    const completedIds = new Set(
      findLatestCompletions(terminal).map((completion) => completion.userId),
    );
    const participantIds = new Set(
      await this.participants.findParticipantIdsForActionById(actionId),
    );
    const arms = await readExperimentArms(em, {
      experiment: Experiment.ActionUpdateRecognition,
      userIds,
    });
    return countRecognitionPreview(
      userIds.map((userId) => ({
        arm: arms.get(userId) ?? null,
        completed: completedIds.has(userId),
        participant: participantIds.has(userId),
      })),
    );
  }
}
