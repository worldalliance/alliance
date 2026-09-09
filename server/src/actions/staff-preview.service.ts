import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CommentParentObject } from "src/forum/entities/comment.entity";
import { User } from "src/user/entities/user.entity";
import { In, Repository } from "typeorm";
import { ActionActivity } from "./entities/action-activity.entity";
import { Action } from "./entities/action.entity";
import {
  actionHiddenFromMembers,
  canSeeStaffPreview,
  isStaffPreviewActive,
  isStaffPreviewFor,
  memberActionHasOpened,
} from "./user-action-status";

export const STAFF_PREVIEW_REFUSAL =
  "This action is a staff preview. Nothing you do here is recorded.";

/** What `ActionsService.findOneOrFail` throws, so the two answers read alike. */
const ACTION_NOT_FOUND = "Action not found";

/** What the write leaves behind, which decides whether a preview takes it. */
export enum StaffPreviewWrite {
  /** Records the viewer on the action: a completion, a withdrawal, a dismissal, an answer, a share code, a donation. */
  Participation = "participation",
  /**
   * Adds to what is said about the action: a comment, a like. Taking one back
   * adds nothing, so an edit, a delete and an unlike are not gated.
   */
  Discussion = "discussion",
}

/**
 * A preview adds a viewer and takes nothing away, so it closes the discussion
 * only where members cannot read the action at all. Where they can, they are
 * already talking about it and the office still owes them an answer.
 */
const refusedWhileMembersCanRead = {
  [StaffPreviewWrite.Participation]: true,
  [StaffPreviewWrite.Discussion]: false,
} as const satisfies Record<StaffPreviewWrite, boolean>;

/**
 * Every member-facing write that names an action passes through here, so a new
 * write endpoint, or a second route to an existing one, has to call
 * `assertWritable`.
 */
@Injectable()
export class StaffPreviewService {
  constructor(
    @InjectRepository(Action)
    private readonly actionRepository: Repository<Action>,
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async assertWritable(params: {
    actionId: number;
    /** The writer. Undefined for a guest. */
    userId?: number;
    write: StaffPreviewWrite;
  }): Promise<void> {
    // One instant for the whole decision, so the two halves of the rule cannot
    // answer for different moments.
    const now = new Date();
    const active = await this.activePreview({ ...params, now });
    if (active) {
      this.assertNotCovered({ ...active, write: params.write, now });
    }
  }

  /** The action and writer behind a preview that is up. */
  private async activePreview(params: {
    actionId: number;
    userId?: number;
    now: Date;
  }): Promise<{ action: Action; user: User | null } | null> {
    const { actionId, userId, now } = params;
    // Almost no action carries the flag, and this runs on every guarded write,
    // so the events relation is only worth loading once the flag is set.
    const flag = await this.actionRepository.findOne({
      where: { id: actionId },
      select: { id: true, staffPreview: true },
    });
    if (!flag) {
      throw new NotFoundException(ACTION_NOT_FOUND);
    }
    if (!flag.staffPreview) {
      return null;
    }

    const action = await this.actionRepository.findOneOrFail({
      where: { id: actionId },
      relations: { events: true },
    });
    if (!isStaffPreviewActive(action, now)) {
      return null;
    }

    const user = userId
      ? await this.userRepository.findOne({ where: { id: userId } })
      : null;
    return { action, user };
  }

  private assertNotCovered(params: {
    action: Action;
    user: User | null;
    write: StaffPreviewWrite;
    now: Date;
  }): void {
    const { action, user, write, now } = params;
    if (canSeeStaffPreview(user)) {
      if (
        refusedWhileMembersCanRead[write] ||
        actionHiddenFromMembers(action, now)
      ) {
        throw new ForbiddenException(STAFF_PREVIEW_REFUSAL);
      }
      return;
    }
    // Everyone else keeps the write they had. Where the action is hidden from
    // members the answer is a not-found, so it never names an unlaunched action
    // to a member. It carries the public-only exception `findOneOrFail` makes;
    // the admin one is answered above, by `canSeeStaffPreview`.
    if (!actionHiddenFromMembers(action, now) || action.publicOnly) {
      return;
    }
    throw new NotFoundException(ACTION_NOT_FOUND);
  }

  async assertWritableForComment(params: {
    parentObjectType: CommentParentObject;
    parentObjectId: number;
    userId: number;
  }): Promise<void> {
    const { parentObjectType, parentObjectId, userId } = params;
    const actionId = await this.commentTargetActionId(
      parentObjectType,
      parentObjectId,
    );
    if (actionId === null) return;
    await this.assertWritable({
      actionId,
      userId,
      write: StaffPreviewWrite.Discussion,
    });
  }

  private async commentTargetActionId(
    parentObjectType: CommentParentObject,
    parentObjectId: number,
  ): Promise<number | null> {
    switch (parentObjectType) {
      case CommentParentObject.Action:
        return parentObjectId;
      case CommentParentObject.Activity: {
        const activity = await this.actionActivityRepository.findOne({
          where: { id: parentObjectId },
          select: { id: true, actionId: true },
        });
        return activity?.actionId ?? null;
      }
      case CommentParentObject.Post:
        // A post carries its own visibility and is reachable without the
        // action it links to, so gating it here would take a member's comment
        // on a post they can still read.
        return null;
      default:
        throw new Error(
          `unknown comment parent: ${parentObjectType satisfies never}`,
        );
    }
  }

  /**
   * Which of `actionIds` this viewer may not comment on or like, so a client
   * can stop offering what {@link assertWritable} refuses.
   */
  async discussionClosedActionIds(
    actionIds: number[],
    userId?: number,
  ): Promise<Set<number>> {
    if (!userId || actionIds.length === 0) return new Set();
    const flagged = await this.actionRepository.find({
      where: { id: In(actionIds), staffPreview: true },
      relations: { events: true },
    });
    if (flagged.length === 0) return new Set();
    const user = await this.userRepository.findOne({ where: { id: userId } });
    const now = new Date();
    return new Set(
      flagged
        .filter(
          (action) =>
            isStaffPreviewFor({ action, user, now }) &&
            actionHiddenFromMembers(action, now),
        )
        .map((action) => action.id),
    );
  }

  async discussionClosedForAction(
    actionId: number,
    userId?: number,
  ): Promise<boolean> {
    return (await this.discussionClosedActionIds([actionId], userId)).has(
      actionId,
    );
  }

  /** Has the launch a flag set now would have previewed already happened? */
  async memberActionOpened(actionId: number): Promise<boolean> {
    const action = await this.actionRepository.findOne({
      where: { id: actionId },
      relations: { events: true },
    });
    return !!action && memberActionHasOpened(action.events, new Date());
  }

  /**
   * Spends the flag on the launch it was set for, so an abandoned preview does
   * not sit on its viewers' home pages for good.
   */
  async clearOpenedPreviews(): Promise<void> {
    const flagged = await this.actionRepository.find({
      where: { staffPreview: true },
      relations: { events: true },
    });
    const now = new Date();
    const opened = flagged.filter((action) =>
      memberActionHasOpened(action.events, now),
    );
    if (opened.length === 0) return;
    await this.actionRepository.update(
      opened.map((action) => action.id),
      { staffPreview: false },
    );
  }
}
