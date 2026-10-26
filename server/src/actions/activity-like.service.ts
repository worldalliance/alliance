import { actionActivityIsVisibleInFeed } from "@alliance/common/actionActivity";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LikeNotificationService } from "src/notifs/like-notification.service";
import { actionActivityUrl } from "src/search/approutes";
import { type Repository } from "typeorm";
import { UserService } from "../user/user.service";
import { ActionsService } from "./actions.service";
import { ActionActivityDto } from "./dto/action-activity.dto";
import {
  ActionActivity,
  loadedActionActivityAction,
  loadedActionActivityLikes,
  loadedActionActivityUser,
} from "./entities/action-activity.entity";
import { assertNotInStaffPreview } from "./staff-preview";

@Injectable()
export class ActivityLikeService {
  constructor(
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    private readonly actionsService: ActionsService,
    private readonly userService: UserService,
    private readonly likeNotificationService: LikeNotificationService,
  ) {}

  async likeActivity(
    id: number,
    userId: number,
    unlike = false,
  ): Promise<ActionActivityDto> {
    const activity = await this.actionActivityRepository.findOne({
      where: { id },
      relations: {
        user: true,
        action: true,
        likes: true,
        editableContent: true,
      },
    });
    if (!activity) {
      throw new NotFoundException("Activity not found");
    }
    assertNotInStaffPreview(
      await this.actionsService.findOneOrFail({
        id: activity.actionId,
        userId,
      }),
    );
    if (!actionActivityIsVisibleInFeed(activity.type)) {
      throw new BadRequestException("Activity type is not supported");
    }
    const user = await this.userService.findOneOrFail(userId);

    const qb = this.actionActivityRepository
      .createQueryBuilder()
      .relation(ActionActivity, "likes")
      .of(activity);

    const liked = loadedActionActivityLikes(activity).some(
      (like) => like.id === user.id,
    );
    let createdLike = false;
    let removedLike = false;
    if (unlike) {
      if (liked) {
        await qb.remove(user);
        removedLike = true;
      }
    } else if (!liked) {
      await qb.add(user);
      createdLike = true;
    }

    // Update likesCount
    if (createdLike || removedLike) {
      await this.actionActivityRepository.update(id, {
        likesCount: () => `"likesCount" ${createdLike ? "+ 1" : "- 1"}`,
      });
    }

    const updatedActivity = await this.actionActivityRepository.findOne({
      where: { id },
      relations: {
        user: true,
        action: true,
        likes: true,
        editableContent: true,
      },
    });
    if (!updatedActivity) {
      throw new NotFoundException("Activity not found");
    }

    if (createdLike) {
      const likedAction = loadedActionActivityAction(updatedActivity);
      await this.likeNotificationService.createOrUpdate({
        owner: loadedActionActivityUser(updatedActivity),
        liker: user,
        targetType: `activity:${activity.type}`,
        targetContent: likedAction.name,
        targetAction: likedAction,
        targetId: updatedActivity.id,
        webAppLocation: actionActivityUrl(
          updatedActivity.actionId,
          updatedActivity.id,
        ),
      });
    }

    if (removedLike) {
      await this.likeNotificationService.removeOnUnlike({
        ownerId: updatedActivity.userId,
        unlikerId: user.id,
        targetType: `activity:${activity.type}`,
        targetId: updatedActivity.id,
      });
    }

    return new ActionActivityDto(updatedActivity, {
      likedByMe: !unlike,
    });
  }
}
