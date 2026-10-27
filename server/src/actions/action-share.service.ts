import { ANONYMOUS_DISPLAY_NAME } from "@alliance/common/displayName";
import { nameParts } from "@alliance/common/nameParts";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ShareUrl } from "src/share-urls/entities/share-url.entity";
import { ShareUrlsService } from "src/share-urls/share-urls.service";
import { FormResponse } from "src/tasks/entities/formresponse.entity";
import { User } from "src/user/entities/user.entity";
import { CachedFilter } from "src/utils/cached-filter";
import { type Repository } from "typeorm";
import { resolveUserActionRelation } from "./action-activity-status";
import { ActionFormLinksService } from "./action-form-links.service";
import { ActionsService } from "./actions.service";
import { ActionSharePreview, UserActionRelation } from "./dto/action.dto";
import { ShareUrlStats } from "./dto/share-url.dto";
import { ActionActivity } from "./entities/action-activity.entity";

@Injectable()
export class ActionShareService {
  constructor(
    @InjectRepository(ActionActivity)
    private readonly actionActivityRepository: Repository<ActionActivity>,
    @InjectRepository(FormResponse)
    private readonly formResponseRepository: Repository<FormResponse>,
    private readonly shareUrlsService: ShareUrlsService,
    private readonly actionsService: ActionsService,
    private readonly formLinks: ActionFormLinksService,
  ) {}

  async getSharePreview(
    actionId: number,
    shareCode?: string,
  ): Promise<ActionSharePreview> {
    // Match public action visibility before exposing referrer completion state.
    await this.actionsService.findOneOrFail({ id: actionId });

    const trimmedCode = shareCode?.trim();
    if (!trimmedCode) {
      return { completedByReferrer: false, validReferral: false };
    }

    const shareUrl = await this.shareUrlsService.findActionShareByActionAndSid(
      actionId,
      trimmedCode,
    );

    // Campaign-owned action share links have no referring user.
    if (shareUrl?.campaign) {
      return {
        firstName: shareUrl.campaign.name,
        completedByReferrer: false,
        validReferral: true,
      };
    }

    if (!shareUrl?.user) {
      return { completedByReferrer: false, validReferral: false };
    }

    return {
      firstName: this.getFirstNameForSharePreview(shareUrl.user),
      completedByReferrer:
        (await this.getActionRelation(actionId, shareUrl.user.id)) ===
        UserActionRelation.Completed,
      validReferral: true,
    };
  }

  async getOrCreateActionReferralCode(
    actionId: number,
    userId: number,
  ): Promise<string> {
    const shareUrl = await this.shareUrlsService.getOrCreateForAction(
      actionId,
      {
        type: "user",
        userId,
      },
    );
    if (!shareUrl.sid) {
      throw new BadRequestException("Unable to create share code");
    }
    return shareUrl.sid;
  }

  private getFirstNameForSharePreview(
    user: Pick<User, "anonymous" | "name">,
  ): string {
    return user.anonymous
      ? ANONYMOUS_DISPLAY_NAME
      : nameParts(user.name).firstname || ANONYMOUS_DISPLAY_NAME;
  }

  private async getActionRelation(
    actionId: number,
    userId: number,
  ): Promise<UserActionRelation> {
    const activities = await this.actionActivityRepository.find({
      where: { action: { id: actionId }, user: { id: userId } },
    });
    return resolveUserActionRelation({
      activities: new CachedFilter(activities),
      userId,
      actionId,
    });
  }

  async getShareLinksForForm(formId: number): Promise<ShareUrl[]> {
    const action = await this.formLinks.findActionByFormId(formId);
    if (!action) {
      throw new NotFoundException("No action found for this form");
    }
    // This is a per-user view (ShareUrlDto requires a user); campaign-owned
    // links have no user and are managed via the admin campaign view instead.
    return this.shareUrlsService.findUserOwnedForAction(action.id);
  }

  async getShareUrlStats(
    actionId: number,
    questionId?: string,
  ): Promise<ShareUrlStats[]> {
    // Per-user referral leaderboard (ShareUrlStats.user is non-null); exclude
    // campaign-owned links, which have no referring user.
    const shareUrls =
      await this.shareUrlsService.findUserOwnedForAction(actionId);

    if (shareUrls.length === 0) {
      return [];
    }

    // Get all sids
    const sids = shareUrls
      .map((su) => su.sid)
      .filter((sid): sid is string => !!sid);

    if (sids.length === 0) {
      return shareUrls.map((su) => ({
        user: su.user!,
        inviteCount: 0,
        sid: su.sid ?? "",
        yesCount: 0,
      }));
    }

    // Count form responses per sid
    const formResponseCounts = await this.formResponseRepository
      .createQueryBuilder("fr")
      .select("fr.sid", "sid")
      .addSelect("COUNT(*)", "count")
      .where("fr.sid IN (:...sids)", { sids })
      .groupBy("fr.sid")
      .getRawMany<{ sid: string; count: string }>();

    const countMap = new Map<string, number>();
    for (const row of formResponseCounts) {
      countMap.set(row.sid, parseInt(row.count, 10));
    }

    // Count yes answers per sid for the specified question
    const yesCountMap = new Map<string, number>();
    if (questionId) {
      const yesAnswerCounts = await this.formResponseRepository
        .createQueryBuilder("fr")
        .select("fr.sid", "sid")
        .addSelect("COUNT(*)", "count")
        .where("fr.sid IN (:...sids)", { sids })
        .andWhere(`fr.answers ->> :questionId = 'yes'`, { questionId })
        .groupBy("fr.sid")
        .getRawMany<{ sid: string; count: string }>();

      for (const row of yesAnswerCounts) {
        yesCountMap.set(row.sid, parseInt(row.count, 10));
      }
    }

    const results = shareUrls
      .map((su) => ({
        user: su.user!,
        inviteCount: countMap.get(su.sid ?? "") ?? 0,
        sid: su.sid ?? "",
        yesCount: yesCountMap.get(su.sid ?? "") ?? 0,
      }))
      .filter((stat) => stat.inviteCount > 0);

    return results.sort((a, b) => b.inviteCount - a.inviteCount);
  }
}
