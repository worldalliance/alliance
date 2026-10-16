import { appendQueryParam } from "@alliance/common/url";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectRepository } from "@nestjs/typeorm";
import { softDeleteCascade, updateLive } from "src/datasources/soft-delete";
import { InviteFeedEvents } from "src/invite-feed.events";
import { User } from "src/user/entities/user.entity";
import { EntityManager, IsNull, Not, Repository } from "typeorm";
import { ExternalShareTarget } from "./entities/external-share-target.entity";
import { ShareUrl, ShareUrlKind } from "./entities/share-url.entity";
import type { StoredInviteAssignment } from "./invite-assignment";
import { updateLiveShareUrl } from "./share-url-locks";
import { ownerWhere, type ShareUrlOwner } from "./share-url-owner";
import { shareUrlPublicUrl } from "./share-url-public-url";
import {
  buildAndSaveShareUrl,
  getOrCreateShareUrl,
  lockExternalTarget,
} from "./share-url-rows";
import type { ShareUrlWithSignupCount } from "./share-url-views";

/** Which target a share-url request points at, before the owner is attached. */
export type ShareTarget =
  | { kind: ShareUrlKind.Action; actionId: number }
  | { kind: ShareUrlKind.ExternalTarget; externalTargetId: number }
  | { kind: ShareUrlKind.Invite };

/**
 * Resolve the loose `{ actionId?, externalTargetId?, invite? }` request shape
 * into a discriminated {@link ShareTarget}, enforcing that exactly one is set.
 */
function resolveTarget(params: {
  actionId?: number;
  externalTargetId?: number;
  invite?: boolean;
}): ShareTarget {
  const provided =
    Number(params.actionId !== undefined) +
    Number(params.externalTargetId !== undefined) +
    Number(params.invite === true);
  if (provided !== 1) {
    throw new BadRequestException(
      "Exactly one of actionId, externalTargetId, or invite must be provided",
    );
  }
  if (params.actionId !== undefined) {
    return { kind: ShareUrlKind.Action, actionId: params.actionId };
  }
  if (params.externalTargetId !== undefined) {
    return {
      kind: ShareUrlKind.ExternalTarget,
      externalTargetId: params.externalTargetId,
    };
  }
  return { kind: ShareUrlKind.Invite };
}

@Injectable()
export class ShareUrlsService {
  constructor(
    @InjectRepository(ShareUrl)
    private readonly shareUrlRepository: Repository<ShareUrl>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getShareLink(params: {
    userId: number;
    actionId?: number;
    externalTargetId?: number;
    invite?: boolean;
  }): Promise<string> {
    const { userId, actionId, externalTargetId, invite } = params;
    const target = resolveTarget({ actionId, externalTargetId, invite });
    const owner: ShareUrlOwner = { type: "user", userId };
    const shareUrl = await this.getOrCreateForTarget(target, owner);
    return shareUrlPublicUrl(shareUrl);
  }

  private async getOrCreateForTarget(
    target: ShareTarget,
    owner: ShareUrlOwner,
  ): Promise<ShareUrl> {
    switch (target.kind) {
      case ShareUrlKind.Action:
        return this.getOrCreateForAction(target.actionId, owner);
      case ShareUrlKind.ExternalTarget:
        return this.getOrCreateForExternalTargetId(
          target.externalTargetId,
          owner,
        );
      case ShareUrlKind.Invite:
        return this.getOrCreateForInvite(owner);
      default:
        throw new Error(`unknown share target kind: ${target satisfies never}`);
    }
  }

  async createDuplicate(params: {
    owner: ShareUrlOwner;
    actionId?: number;
    externalTargetId?: number;
    invite?: boolean;
    label?: string;
  }): Promise<ShareUrl> {
    const { owner, actionId, externalTargetId, invite, label } = params;
    const target = resolveTarget({ actionId, externalTargetId, invite });
    const trimmedLabel = label?.trim();
    const labelValue = trimmedLabel ? trimmedLabel : null;
    switch (target.kind) {
      case ShareUrlKind.Action:
        return this.createDuplicateForAction(
          target.actionId,
          owner,
          labelValue,
        );
      case ShareUrlKind.ExternalTarget:
        return this.createDuplicateForExternalTargetId(
          target.externalTargetId,
          owner,
          labelValue,
        );
      case ShareUrlKind.Invite:
        return this.createDuplicateForInvite(owner, labelValue);
      default:
        throw new Error(`unknown share target kind: ${target satisfies never}`);
    }
  }

  async createDuplicateForInvite(
    owner: ShareUrlOwner,
    label: string | null,
    inviteAssignment?: StoredInviteAssignment,
  ): Promise<ShareUrl> {
    const shareUrl = await buildAndSaveShareUrl(
      this.shareUrlRepository.manager,
      {
        kind: ShareUrlKind.Invite,
        owner,
        duplicate: true,
        label,
        inviteAssignment,
      },
    );
    this.eventEmitter.emit(InviteFeedEvents.Created);
    return shareUrl;
  }

  async getOrCreateForInvite(owner: ShareUrlOwner): Promise<ShareUrl> {
    return getOrCreateShareUrl(this.shareUrlRepository.manager, {
      kind: ShareUrlKind.Invite,
      owner,
    });
  }

  private async createDuplicateForExternalTargetId(
    externalTargetId: number,
    owner: ShareUrlOwner,
    label: string | null,
  ): Promise<ShareUrl> {
    return this.shareUrlRepository.manager.transaction(async (m) => {
      const target = await lockExternalTarget(m, externalTargetId);
      return buildAndSaveShareUrl(m, {
        kind: ShareUrlKind.ExternalTarget,
        externalTarget: target,
        owner,
        duplicate: true,
        label,
      });
    });
  }

  private async createDuplicateForAction(
    actionId: number,
    owner: ShareUrlOwner,
    label: string | null,
  ): Promise<ShareUrl> {
    return buildAndSaveShareUrl(this.shareUrlRepository.manager, {
      kind: ShareUrlKind.Action,
      actionId,
      owner,
      duplicate: true,
      label,
    });
  }

  async withSignupCounts(
    shareUrls: ShareUrl[],
  ): Promise<ShareUrlWithSignupCount[]> {
    if (shareUrls.length === 0) return [];

    const counts = await this.userRepository
      .createQueryBuilder("user")
      .select("user.referredByShareUrlId", "shareUrlId")
      .addSelect("COUNT(*)", "signupCount")
      .where("user.referredByShareUrlId IN (:...shareUrlIds)", {
        shareUrlIds: shareUrls.map((shareUrl) => shareUrl.id),
      })
      .groupBy("user.referredByShareUrlId")
      .getRawMany<{ shareUrlId: string; signupCount: string }>();
    const countsByShareUrlId = new Map(
      counts.map((count) => [count.shareUrlId, Number(count.signupCount)]),
    );

    return shareUrls.map((shareUrl) => ({
      shareUrl,
      signupCount: countsByShareUrlId.get(shareUrl.id) ?? 0,
    }));
  }

  async findForOwner(owner: ShareUrlOwner): Promise<ShareUrlWithSignupCount[]> {
    const shareUrls = await this.shareUrlRepository.find({
      where: ownerWhere(owner),
      relations: { action: true, externalTarget: true },
      order: { createdAt: "DESC" },
    });
    return this.withSignupCounts(shareUrls);
  }

  async findForUser(userId: number): Promise<ShareUrlWithSignupCount[]> {
    return this.findForOwner({ type: "user", userId });
  }

  async deleteById(id: string): Promise<void> {
    const row = await this.shareUrlRepository.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException("share url not found");
    }
    await softDeleteCascade(this.shareUrlRepository.manager, {
      target: ShareUrl,
      ids: [row.id],
    });
  }

  async findForCampaign(
    campaignId: number,
  ): Promise<ShareUrlWithSignupCount[]> {
    return this.findForOwner({ type: "campaign", campaignId });
  }

  async updateLabel(
    id: string,
    rawLabel: string | undefined,
  ): Promise<ShareUrl> {
    const trimmed = rawLabel?.trim();
    const nextLabel = trimmed ? trimmed : null;
    return updateLiveShareUrl(this.shareUrlRepository.manager, {
      id,
      changes: { label: nextLabel },
      relations: { action: true, externalTarget: true },
    });
  }

  private async getOrCreateForExternalTargetId(
    externalTargetId: number,
    owner: ShareUrlOwner,
  ): Promise<ShareUrl> {
    return this.shareUrlRepository.manager.transaction(async (m) => {
      const target = await lockExternalTarget(m, externalTargetId);
      return getOrCreateShareUrl(m, {
        kind: ShareUrlKind.ExternalTarget,
        externalTarget: target,
        owner,
      });
    });
  }

  async getOrCreateForAction(
    actionId: number,
    owner: ShareUrlOwner,
  ): Promise<ShareUrl> {
    return getOrCreateShareUrl(this.shareUrlRepository.manager, {
      kind: ShareUrlKind.Action,
      actionId,
      owner,
    });
  }

  async findActionShareByActionAndSid(
    actionId: number,
    sid: string,
  ): Promise<ShareUrl | null> {
    return this.shareUrlRepository.findOne({
      where: { action: { id: actionId }, sid },
      relations: { user: true, campaign: true },
    });
  }

  async findByReferralSid(sid: string): Promise<ShareUrl | null> {
    return this.shareUrlRepository.findOne({
      where: { sid },
      relations: {
        user: true,
        campaign: true,
        action: true,
        externalTarget: true,
      },
    });
  }

  async findUserBySid(sid: string): Promise<User | null> {
    const trimmed = sid.trim();
    if (!trimmed) return null;
    const shareUrl = await this.shareUrlRepository.findOne({
      where: { sid: trimmed },
      relations: { user: true },
    });
    return shareUrl?.user ?? null;
  }

  async findActionShareSidsForUser(userId: number): Promise<string[]> {
    const shareUrls = await this.shareUrlRepository.find({
      where: { user: { id: userId }, actionId: Not(IsNull()) },
    });
    return shareUrls.map((su) => su.sid).filter((s): s is string => !!s);
  }

  /**
   * Share links owned by a referring user (campaign-owned links, which have no
   * user, are excluded). Callers can safely treat `user` as non-null.
   */
  async findUserOwnedForAction(actionId: number): Promise<ShareUrl[]> {
    return this.shareUrlRepository.find({
      where: { action: { id: actionId }, user: Not(IsNull()) },
      relations: { user: true },
    });
  }

  async recomputeUrlsForExternalTarget(
    target: ExternalShareTarget,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager?.getRepository(ShareUrl) ?? this.shareUrlRepository;
    const rows = await repo.find({
      where: { externalTarget: { id: target.id } },
    });
    for (const row of rows) {
      if (!row.sid) continue;
      await updateLive(repo.manager, {
        target: ShareUrl,
        id: row.id,
        changes: {
          url: appendQueryParam(target.url, target.paramName, row.sid),
        },
      });
    }
  }
}
