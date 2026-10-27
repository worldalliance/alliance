import { ActionActivityType } from "@alliance/common/actionActivity";
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { groupBy } from "es-toolkit";
import { CommentParentObject } from "src/forum/entities/comment.entity";
import { sqlUserHasEverSigned } from "src/user/entities/contract-event.entity";
import { type Repository } from "typeorm";
import { UserService } from "../user/user.service";
import { sqlIsLatestCompletion } from "./action-activity-status";
import { CohortResolutionSession } from "./cohort-resolution-session";
import { CohortResolverService } from "./cohort-resolver.service";
import { WelcomeQueue } from "./dto/action-activity.dto";
import { ActionActivity } from "./entities/action-activity.entity";
import { ActionStatus } from "./entities/action-event.entity";
import { Action, parseAction } from "./entities/action.entity";
import { computeCanCompleteAction } from "./user-action-status";

@Injectable()
export class WelcomeQueueService {
  constructor(
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    private readonly userService: UserService,
    private readonly cohortResolverService: CohortResolverService,
  ) {}

  async findWelcomeQueue(): Promise<WelcomeQueue> {
    const onboardingActions = await this.actionRepository.find({
      where: {
        onboarding: true,
        optional: false,
        archived: false,
        preventCompletion: false,
      },
      relations: { events: true },
    });
    const requiredActions = onboardingActions
      .filter((action) => action.status === ActionStatus.MemberAction)
      .map(parseAction);
    const actionIds = requiredActions.map((action) => action.id);
    const requiredActionCount = actionIds.length;
    if (!requiredActionCount) return { requiredActionCount, members: [] };

    const rows = await this.actionActivityRepository.query<
      {
        userId: number;
        actionId: number;
        activityId: number;
        completedAt: Date;
        staffLikeCount: string;
      }[]
    >(
      `
        SELECT activity."userId", activity."actionId", activity.id AS "activityId",
          activity."createdAt" AS "completedAt", COUNT(staff_liker.id) AS "staffLikeCount"
        FROM action_activity activity
        LEFT JOIN action_activity_likes_user activity_like
          ON activity_like."actionActivityId" = activity.id
        LEFT JOIN "user" staff_liker
          ON staff_liker.id = activity_like."userId" AND staff_liker.staff = true
          AND staff_liker."deletedAt" IS NULL
        WHERE activity."actionId" = ANY($1::int[])
        AND ${sqlIsLatestCompletion("activity")}
        AND ${sqlUserHasEverSigned('activity."userId"')}
        AND NOT EXISTS (
          SELECT 1
          FROM action_activity completion
          INNER JOIN action ON action.id = completion."actionId" AND action.onboarding = true
            AND action."deletedAt" IS NULL
          INNER JOIN comment ON comment."parentObjectType" = $3
            AND comment."parentObjectId" = completion.id AND comment."deletedAt" IS NULL
          INNER JOIN "user" author ON author.id = comment."authorId" AND author.staff = true
            AND author."deletedAt" IS NULL
          WHERE completion."userId" = activity."userId" AND completion.type = $2
            AND completion."deletedAt" IS NULL
        )
        GROUP BY activity.id, activity."userId", activity."actionId", activity."createdAt"
        ORDER BY activity."createdAt" DESC, activity.id DESC
      `,
      [
        actionIds,
        ActionActivityType.USER_COMPLETED,
        CommentParentObject.Activity,
      ],
    );
    const rowsByUser = groupBy(rows, (row) => row.userId);
    const users = await this.userService.findByIds(
      Object.keys(rowsByUser).map(Number),
      { contractEvents: true },
    );
    const session = new CohortResolutionSession();
    session.candidateUserIds = Promise.resolve(
      new Set(users.map((user) => user.id)),
    );
    const cohorts = await Promise.all(
      requiredActions.map((action) =>
        this.cohortResolverService.resolveDecidedCohort({
          action,
          session,
        }),
      ),
    );

    const now = new Date();
    return {
      requiredActionCount,
      members: users
        .flatMap((user) => {
          const applicableActions = requiredActions.filter((action, index) =>
            computeCanCompleteAction({
              action,
              user,
              inCohort: cohorts[index].has(user.id),
              now,
            }),
          );
          const applicableIds = new Set(
            applicableActions.map((action) => action.id),
          );
          const completions = rowsByUser[user.id].filter((row) =>
            applicableIds.has(row.actionId),
          );
          const latest = completions[0];
          if (!latest || completions.length !== applicableIds.size) return [];
          return [
            {
              user,
              actionId: latest.actionId,
              activityId: latest.activityId,
              completedAt: latest.completedAt,
              staffLikeCount: Number(latest.staffLikeCount),
            },
          ];
        })
        .sort(
          (a, b) =>
            b.completedAt.getTime() - a.completedAt.getTime() ||
            b.activityId - a.activityId,
        ),
    };
  }
}
