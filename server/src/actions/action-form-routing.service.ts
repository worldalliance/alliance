import { ActionActivityType } from "@alliance/common/actionActivity";
import type { CohortExpression } from "@alliance/common/cohort-expression";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { softDeleteWhere } from "src/datasources/soft-delete";
import { NotificationCategory } from "src/notifs/entities/notification.entity";
import {
  action as actionSegment,
  notifMessage,
} from "src/notifs/notification-content";
import { NotifsService } from "src/notifs/notifs.service";
import { actionUrl } from "src/search/approutes";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { UserService } from "src/user/user.service";
import { type EntityManager, In, IsNull, type Repository } from "typeorm";
import { ActionBranchService } from "./action-branch.service";
import { firstMatchIndexes, firstMatchingBranchIds } from "./action-branches";
import { ActionParticipantsService } from "./action-participants.service";
import { CohortResolutionSession } from "./cohort-resolution-session";
import { CohortResolverService } from "./cohort-resolver.service";
import { ActionActivity } from "./entities/action-activity.entity";
import { ActionBranch } from "./entities/action-branch.entity";
import { ActionFormAssignment } from "./entities/action-form-assignment.entity";
import { ActionFormVariant } from "./entities/action-form-variant.entity";
import { Action, parseAction } from "./entities/action.entity";
import { liveAssignments } from "./new-assignment";

export enum MoveTargetKind {
  Variant = "variant",
  Branch = "branch",
}

export type MoveTarget = { kind: MoveTargetKind; id: number };

export type RerouteMove = {
  userId: number;
  fromBranchId: number;
  toBranchId: number;
};

@Injectable()
export class ActionFormRoutingService {
  constructor(
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(ActionFormAssignment)
    private readonly assignmentRepository: Repository<ActionFormAssignment>,
    private readonly actionBranchService: ActionBranchService,
    private readonly cohortResolverService: CohortResolverService,
    private readonly participants: ActionParticipantsService,
    private readonly userService: UserService,
    private readonly notifsService: NotifsService,
  ) {}

  findAssignments(actionId: number): Promise<ActionFormAssignment[]> {
    return this.assignmentRepository.find({
      where: { actionId },
      relations: { user: true, overriddenBy: true },
      order: { userId: "ASC" },
    });
  }

  /**
   * Moves the member to the variant or branch and marks the move as staff's,
   * so a re-route leaves them. A completed member goes back to joined: their
   * completion is withdrawn and they complete by submitting the new form.
   */
  async moveMember(params: {
    actionId: number;
    userId: number;
    to: MoveTarget;
    notify: boolean;
    staffUserId: number;
    now: Date;
  }): Promise<void> {
    const { actionId, userId, to, notify, staffUserId, now } = params;
    const action = await this.actionRepository.findOne({
      where: { id: actionId },
    });
    if (!action) throw new NotFoundException("Action not found");

    const uncompleted = await this.assignmentRepository.manager.transaction(
      async (em) => {
        await this.assertTargetOnAction(em, { actionId, to });
        const existing = await em.findOne(ActionFormAssignment, {
          where: { actionId, userId },
          lock: { mode: "pessimistic_write" },
        });
        if (!existing && to.kind === MoveTargetKind.Branch) {
          throw new BadRequestException(
            "This member isn't routed to a branch of this action. Include them in its cohort first.",
          );
        }
        const target = {
          variantId: to.kind === MoveTargetKind.Variant ? to.id : null,
          branchId: to.kind === MoveTargetKind.Branch ? to.id : null,
        };
        if (
          existing?.variantId === target.variantId &&
          existing.branchId === target.branchId
        ) {
          throw new BadRequestException(
            `The member is already on that ${to.kind}.`,
          );
        }
        const [live] = await liveAssignments(em, [
          { actionId, userId, ...target },
        ]);
        if (!live) {
          throw new NotFoundException(`That ${to.kind} is no longer here.`);
        }
        const override = {
          ...target,
          overriddenAt: now,
          overriddenById: staffUserId,
        };
        if (existing) {
          await em.update(ActionFormAssignment, existing.id, override);
        } else {
          await em.insert(ActionFormAssignment, { ...live, ...override });
        }
        return softDeleteWhere(em, {
          target: ActionActivity,
          where: { actionId, userId, type: ActionActivityType.USER_COMPLETED },
        });
      },
    );

    if (uncompleted > 0) {
      await this.participants.reloadUsersCompletedForAction(actionId);
    }
    if (notify) await this.notifyMoved({ action, userIds: [userId] });
  }

  /**
   * The members each of `rules`, in order, would get if they were the action's
   * branches: its cohort with prerequisites resolved, routed to the first rule
   * they match. Members without an active contract are left in; the decisions
   * leave them out.
   */
  async previewRouting(params: {
    actionId: number;
    rules: CohortExpression[];
  }): Promise<number[][]> {
    const { actionId, rules } = params;
    const action = await this.actionRepository.findOne({
      where: { id: actionId },
    });
    if (!action) throw new NotFoundException("Action not found");
    const { cohortExpression, prerequisiteActionIds } = parseAction(action);
    const session = new CohortResolutionSession();
    const [cohort, matches] = await Promise.all([
      this.cohortResolverService.resolveReadyMemberIds({
        action: { id: actionId, prerequisiteActionIds },
        expression: cohortExpression,
        session,
      }),
      Promise.all(
        rules.map((rule) =>
          this.cohortResolverService.resolveCohortMemberIds(rule, session),
        ),
      ),
    ]);
    const indexByUser = firstMatchIndexes({ matches, userIds: cohort });
    return rules.map((_, index) =>
      [...indexByUser].flatMap(([userId, matched]) =>
        matched === index ? [userId] : [],
      ),
    );
  }

  /** The members a re-route would move: not moved by hand, not yet submitted on their branch, now first matching another branch. */
  async previewReroute(actionId: number): Promise<RerouteMove[]> {
    const session = new CohortResolutionSession();
    const branches = await this.actionBranchService.loadBranches(
      actionId,
      session,
    );
    if (branches.length === 0) {
      throw new BadRequestException(
        "Only an action that routes members by branch rules can re-route them.",
      );
    }
    const assignments = await this.assignmentRepository.find({
      where: { actionId, overriddenAt: IsNull() },
    });
    const pending = await this.withoutSubmitted({
      em: this.assignmentRepository.manager,
      assignments,
      branches,
    });
    if (pending.length === 0) return [];

    await this.cohortResolverService.primeActiveUsers(session, () =>
      this.userService.findActiveUsersForRoster(),
    );
    const matches = await Promise.all(
      branches.map((branch) =>
        this.cohortResolverService.resolveCohortMemberIds(branch.rule, session),
      ),
    );
    const branchIdByUser = firstMatchingBranchIds({
      branches,
      matches,
      userIds: pending.map((a) => a.userId),
    });
    return pending.flatMap(({ userId, branchId }) => {
      const toBranchId = branchIdByUser.get(userId);
      return branchId === null ||
        toBranchId === undefined ||
        toBranchId === branchId
        ? []
        : [{ userId, fromBranchId: branchId, toBranchId }];
    });
  }

  /** Applies {@link previewReroute}, skipping members who submitted or were moved by hand meanwhile. */
  async reroute(params: {
    actionId: number;
    notify: boolean;
  }): Promise<RerouteMove[]> {
    const { actionId, notify } = params;
    const moves = await this.previewReroute(actionId);
    if (moves.length === 0) return [];
    const branches = await this.actionBranchService.loadBranches(
      actionId,
      new CohortResolutionSession(),
    );

    const moved = await this.assignmentRepository.manager.transaction(
      async (em) => {
        const locked = await em.find(ActionFormAssignment, {
          where: {
            actionId,
            userId: In(moves.map((m) => m.userId)),
            overriddenAt: IsNull(),
          },
          lock: { mode: "pessimistic_write" },
        });
        const unsubmitted = await this.withoutSubmitted({
          em,
          assignments: locked,
          branches,
        });
        const current = new Map(unsubmitted.map((a) => [a.userId, a]));
        const applied = moves.filter(
          (move) => current.get(move.userId)?.branchId === move.fromBranchId,
        );
        const live = await liveAssignments(
          em,
          applied.map((move) => ({
            actionId,
            userId: move.userId,
            variantId: null,
            branchId: move.toBranchId,
          })),
        );
        for (const { userId, branchId } of live) {
          await em.update(
            ActionFormAssignment,
            { actionId, userId, overriddenAt: IsNull() },
            { branchId },
          );
        }
        const liveUserIds = new Set(live.map((a) => a.userId));
        return applied.filter((move) => liveUserIds.has(move.userId));
      },
    );

    if (notify && moved.length > 0) {
      const action = await this.actionRepository.findOneOrFail({
        where: { id: actionId },
      });
      await this.notifyMoved({ action, userIds: moved.map((m) => m.userId) });
    }
    return moved;
  }

  private async assertTargetOnAction(
    em: EntityManager,
    params: { actionId: number; to: MoveTarget },
  ): Promise<void> {
    const { actionId, to } = params;
    const target =
      to.kind === MoveTargetKind.Variant ? ActionFormVariant : ActionBranch;
    if (!(await em.existsBy(target, { id: to.id, actionId }))) {
      throw new NotFoundException(`That ${to.kind} isn't on this action.`);
    }
  }

  private async withoutSubmitted(params: {
    em: EntityManager;
    assignments: ActionFormAssignment[];
    branches: Pick<ActionBranch, "id" | "formId">[];
  }): Promise<ActionFormAssignment[]> {
    const { em, assignments, branches } = params;
    if (assignments.length === 0) return [];
    const formIdByBranch = new Map(branches.map((b) => [b.id, b.formId]));
    const responses = await em.find(FormResponse, {
      where: {
        formId: In(branches.map((b) => b.formId)),
        user: { id: In(assignments.map((a) => a.userId)) },
      },
      relations: { user: true },
      select: { formId: true, user: { id: true } },
    });
    const submitted = new Set(
      responses.map((r) => `${r.user?.id}:${r.formId}`),
    );
    return assignments.filter(
      (a) =>
        a.branchId !== null &&
        !submitted.has(`${a.userId}:${formIdByBranch.get(a.branchId)}`),
    );
  }

  /** The action segment renders as each recipient's branch names it, so the notice names their new title. */
  private async notifyMoved(params: {
    action: Pick<Action, "id" | "name">;
    userIds: number[];
  }): Promise<void> {
    const { action, userIds } = params;
    await this.notifsService.sendNotifs(
      userIds.map((userId) => ({
        user: { id: userId },
        category: NotificationCategory.ActionBranchMoved,
        message: notifMessage`Your action is now ${actionSegment(action)}`,
        destination: null,
        webAppLocation: actionUrl(action.id),
        mobileAppLocation: actionUrl(action.id),
        associatedUsers: [],
        shouldPush: true,
      })),
    );
  }
}
