import { publicDisplayName } from "@alliance/common/displayName";
import { DEFAULT_INVITE_MESSAGE_TEMPLATE } from "@alliance/common/inviteMessage";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Community } from "src/community/entities/community.entity";
import { softDeleteCascade, writeUnderLive } from "src/datasources/soft-delete";
import { User } from "src/user/entities/user.entity";
import {
  In,
  IsNull,
  MoreThanOrEqual,
  Not,
  type QueryDeepPartialEntity,
  Repository,
} from "typeorm";
import { InviteMessageTemplate } from "./entities/invite-message-template.entity";
import { ShareUrl, ShareUrlKind } from "./entities/share-url.entity";
import {
  inviteAssignmentColumns,
  inviteAssignmentFromColumns,
  type StoredInviteAssignment,
  StoredInviteAssignmentKind,
} from "./invite-assignment";
import { updateLiveShareUrl } from "./share-url-locks";
import type { ReusableInviteFeedItem, ShareUrlMine } from "./share-url-views";
import { ShareUrlsService } from "./share-urls.service";

const INVITE_MESSAGE_TEMPLATE_ID = "default";

/** A chosen group, or no group at all, as the link stores it. */
function inviteAssignmentFor(
  communityId: number | null,
): StoredInviteAssignment {
  return communityId !== null
    ? { kind: StoredInviteAssignmentKind.Community, communityId }
    : { kind: StoredInviteAssignmentKind.Open };
}

@Injectable()
export class InviteShareUrlsService {
  constructor(
    @InjectRepository(ShareUrl)
    private readonly shareUrlRepository: Repository<ShareUrl>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Community)
    private readonly communityRepository: Repository<Community>,
    @InjectRepository(InviteMessageTemplate)
    private readonly inviteMessageTemplateRepository: Repository<InviteMessageTemplate>,
    private readonly shareUrlsService: ShareUrlsService,
  ) {}

  async getInviteMessageTemplate(): Promise<string> {
    const setting = await this.inviteMessageTemplateRepository.findOneBy({
      id: INVITE_MESSAGE_TEMPLATE_ID,
    });
    return setting?.template ?? DEFAULT_INVITE_MESSAGE_TEMPLATE;
  }

  async updateInviteMessageTemplate(template: string): Promise<string> {
    await this.inviteMessageTemplateRepository.upsert(
      { id: INVITE_MESSAGE_TEMPLATE_ID, template, deletedAt: null },
      ["id"],
    );
    return template;
  }

  /** Signup counts plus the destination group resolved by name, for display. */
  async withInviteDestinations(shareUrls: ShareUrl[]): Promise<ShareUrlMine[]> {
    const withCounts = await this.shareUrlsService.withSignupCounts(shareUrls);
    const assignments = withCounts.map((row) =>
      inviteAssignmentFromColumns(row.shareUrl),
    );
    const communityIds = assignments.flatMap((assignment) =>
      assignment?.kind === StoredInviteAssignmentKind.Community &&
      assignment.communityId !== null
        ? [assignment.communityId]
        : [],
    );
    const communities = communityIds.length
      ? await this.communityRepository.find({
          where: { id: In(communityIds) },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(
      communities.map((community) => [community.id, community.name]),
    );

    return withCounts.map((row, index) => {
      const assignment = assignments[index] ?? null;
      return {
        ...row,
        assignment,
        assignmentCommunityName:
          assignment?.kind === StoredInviteAssignmentKind.Community &&
          assignment.communityId !== null
            ? (nameById.get(assignment.communityId) ?? null)
            : null,
      };
    });
  }

  async findInvitesForUser(userId: number): Promise<ShareUrlMine[]> {
    const shareUrls = await this.shareUrlRepository.find({
      where: { user: { id: userId }, kind: ShareUrlKind.Invite },
      order: { duplicate: "ASC", createdAt: "DESC" },
    });
    return this.withInviteDestinations(shareUrls);
  }

  async findReusableInviteFeed(
    startAt: Date,
  ): Promise<ReusableInviteFeedItem[]> {
    const shareUrls = await this.shareUrlRepository.find({
      where: {
        kind: ShareUrlKind.Invite,
        duplicate: true,
        userId: Not(IsNull()),
        createdAt: MoreThanOrEqual(startAt),
      },
      relations: { user: true },
      order: { createdAt: "DESC", id: "DESC" },
    });

    return shareUrls.flatMap((shareUrl) => {
      if (!shareUrl.user) return [];
      return {
        id: shareUrl.id,
        createdAt: shareUrl.createdAt,
        invitingUserDisplayName: publicDisplayName(shareUrl.user),
        communityId:
          shareUrl.inviteAssignmentKind === StoredInviteAssignmentKind.Community
            ? shareUrl.inviteAssignmentCommunityId
            : null,
      };
    });
  }

  // Leadership, not canManageCommunity: signup placement rechecks that the
  // link's owner leads the group (`selectCommunityForReferral`), so a link
  // aimed at a group its owner doesn't lead places nobody.
  private async assertLeadsCommunity(
    userId: number,
    communityId: number,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { leaderOf: true },
    });
    if (!user) {
      throw new NotFoundException("user not found");
    }
    if (!user.leaderOfIdSet.has(communityId)) {
      throw new BadRequestException(
        `User is not a leader of community ${communityId}`,
      );
    }
  }

  /**
   * `communityId` is required rather than optional: a missing one would fall
   * through to an `open` assignment, which places signups anywhere *except*
   * this user's groups. Callers must say which they mean.
   */
  async createDuplicateInviteForUser(
    userId: number,
    label: string | undefined,
    communityId: number | null,
  ): Promise<ShareUrl> {
    if (communityId !== null) {
      await this.assertLeadsCommunity(userId, communityId);
    }

    const trimmedLabel = label?.trim();
    return this.shareUrlsService.createDuplicateForInvite(
      { type: "user", userId },
      trimmedLabel ? trimmedLabel : null,
      inviteAssignmentFor(communityId),
    );
  }

  /**
   * Edit what the owner chose when the link was made. Each field is left alone
   * when omitted, so the caller can send only what changed.
   *
   * Retargeting moves future signups only: everyone who registered already
   * carries their own copy of the destination.
   */
  async updateInviteForUser(params: {
    id: string;
    userId: number;
    label?: string;
    communityId?: number | null;
  }): Promise<ShareUrl> {
    const { id, userId, label, communityId } = params;
    const row = await this.shareUrlRepository.findOne({
      where: { id, kind: ShareUrlKind.Invite },
    });
    if (!row || row.userId !== userId) {
      throw new NotFoundException("share url not found");
    }
    if (communityId !== undefined && communityId !== null) {
      await this.assertLeadsCommunity(userId, communityId);
    }

    const changes: QueryDeepPartialEntity<ShareUrl> = {};
    if (label !== undefined) {
      const trimmed = label.trim();
      changes.label = trimmed ? trimmed : null;
    }
    if (communityId !== undefined) {
      Object.assign(
        changes,
        inviteAssignmentColumns(inviteAssignmentFor(communityId)),
      );
    }
    return writeUnderLive(this.shareUrlRepository.manager, {
      parents:
        communityId === undefined || communityId === null
          ? []
          : [{ target: Community, id: communityId }],
      write: (manager) => updateLiveShareUrl(manager, { id, changes }),
    });
  }

  async deleteInviteForUser(id: string, userId: number): Promise<void> {
    const row = await this.shareUrlRepository.findOne({
      where: { id, kind: ShareUrlKind.Invite },
    });
    if (!row || row.userId !== userId) {
      throw new NotFoundException("share url not found");
    }
    if (!row.duplicate) {
      throw new BadRequestException(
        "Your primary invite link cannot be deleted.",
      );
    }
    await softDeleteCascade(this.shareUrlRepository.manager, {
      target: ShareUrl,
      ids: [row.id],
    });
  }
}
