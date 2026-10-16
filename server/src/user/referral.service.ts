import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CampaignService } from "src/campaign/campaign.service";
import { Campaign } from "src/campaign/entities/campaign.entity";
import {
  ShareUrl,
  ShareUrlKind,
} from "src/share-urls/entities/share-url.entity";
import { ShareUrlsService } from "src/share-urls/share-urls.service";
import type { Relations } from "src/utils/Repository";
import { Brackets, type Repository } from "typeorm";
import { Friend } from "./entities/friend.entity";
import {
  loadedOnetimeInviteInvitingUser,
  OnetimeInvite,
} from "./entities/onetime-invite.entity";
import {
  ReferralSource,
  sqlUserHasActiveContractAt,
  User,
} from "./entities/user.entity";
import { acceptedFriendshipSql, friendOf } from "./friendship";
import { OnetimeInviteService } from "./onetime-invite.service";
import { sqlUserHasProfilePicture } from "./profile-picture";
import { UserService } from "./user.service";

export type ReferrerResolution =
  | { kind: "user"; user: User }
  | { kind: "campaign"; campaign: Campaign };

/**
 * Which referral source a user-owned share-url attributes a signup to, keyed by
 * the share-url's kind. `Record<ShareUrlKind, …>` forces every kind to be
 * handled when a new one is added.
 */
const REFERRAL_SOURCE_BY_SHARE_KIND: Record<
  ShareUrlKind,
  | ReferralSource.ActionShareLink
  | ReferralSource.ExternalShareLink
  | ReferralSource.InviteShareLink
> = {
  [ShareUrlKind.Action]: ReferralSource.ActionShareLink,
  [ShareUrlKind.ExternalTarget]: ReferralSource.ExternalShareLink,
  [ShareUrlKind.Invite]: ReferralSource.InviteShareLink,
};

/**
 * What a referral code/sid points to, resolved in a fixed precedence order
 * (onetime invite → campaign-owned share link → user-owned share link →
 * bare campaign code → user referral code). Side-effect free: callers apply
 * their own behaviour (signup attribution in AuthService, display in
 * ReferralService.resolveReferrer). See {@link ReferralService.resolveReferral}.
 */
export type ReferralResolution =
  | { kind: "invite"; invite: OnetimeInvite }
  | { kind: "campaign"; campaign: Campaign }
  | {
      kind: "user";
      user: User;
      shareUrl: ShareUrl | null;
      referralSource:
        | ReferralSource.ActionShareLink
        | ReferralSource.ExternalShareLink
        | ReferralSource.InviteShareLink
        | ReferralSource.ReferralLink;
    };

const SIGNUP_SOCIAL_PROOF_COUNT = 5;

/** A ceiling on the caller's count: the endpoint is public and unpaginated. */
const SIGNUP_SOCIAL_PROOF_MAX = 24;

@Injectable()
export class ReferralService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Friend)
    private readonly friendRepository: Repository<Friend>,
    private readonly userService: UserService,
    private readonly onetimeInviteService: OnetimeInviteService,
    private readonly shareUrlsService: ShareUrlsService,
    private readonly campaignService: CampaignService,
  ) {}

  /**
   * Resolve a referral code/sid to whatever it points to, in a fixed
   * precedence order, with no side effects. The single source of truth for
   * referral precedence — both signup attribution (AuthService) and the
   * signup-page inviter display ({@link resolveReferrer}) build on it, so the
   * two can't drift. `opts.inviteRelations` lets a caller load the matched
   * invite with extra relations (AuthService needs the inviting user's
   * communities).
   */
  async resolveReferral(
    code: string,
    opts?: { inviteRelations?: Relations<OnetimeInvite> },
  ): Promise<ReferralResolution | null> {
    const invite = await this.onetimeInviteService.findInviteByCode(
      code,
      opts?.inviteRelations,
    );
    if (invite) {
      return { kind: "invite", invite };
    }
    const shareUrl = await this.shareUrlsService.findByReferralSid(code);
    if (shareUrl?.campaign) {
      return { kind: "campaign", campaign: shareUrl.campaign };
    }
    if (shareUrl?.user) {
      return {
        kind: "user",
        user: shareUrl.user,
        shareUrl,
        referralSource: REFERRAL_SOURCE_BY_SHARE_KIND[shareUrl.kind],
      };
    }
    const campaign = await this.campaignService.findByCode(code);
    if (campaign) {
      return { kind: "campaign", campaign };
    }
    const user = await this.userService.findOneByReferralCode(code);
    if (user) {
      return {
        kind: "user",
        user,
        shareUrl: null,
        referralSource: ReferralSource.ReferralLink,
      };
    }
    return null;
  }

  /**
   * Resolve a referral code/sid to whoever (or whatever) referred the signup:
   * a referring user, or a userless campaign — for display on the signup page.
   */
  async resolveReferrer(code: string): Promise<ReferrerResolution | null> {
    const resolution = await this.resolveReferral(code);
    if (!resolution) return null;
    switch (resolution.kind) {
      case "invite": {
        const invitingUser = loadedOnetimeInviteInvitingUser(resolution.invite);
        return invitingUser ? { kind: "user", user: invitingUser } : null;
      }
      case "campaign":
        return { kind: "campaign", campaign: resolution.campaign };
      case "user":
        return { kind: "user", user: resolution.user };
      default:
        throw new Error(
          `unknown referral resolution: ${resolution satisfies never}`,
        );
    }
  }

  private async findFriendUsersWithProfilePictures(
    inviterId: number,
  ): Promise<User[]> {
    const contractAt = new Date();
    const rels = await this.friendRepository
      .createQueryBuilder("f")
      .innerJoinAndSelect("f.requester", "req")
      .innerJoinAndSelect("f.addressee", "addr")
      .where(acceptedFriendshipSql("f"))
      .andWhere("(f.requesterId = :inviterId OR f.addresseeId = :inviterId)", {
        inviterId,
      })
      .andWhere(
        new Brackets((sqb) => {
          sqb
            .where(
              `f.requesterId = :inviterId AND ${sqlUserHasProfilePicture('addr."profilePicture"')} AND (${sqlUserHasActiveContractAt("addr.id")})`,
            )
            .orWhere(
              `f.addresseeId = :inviterId AND ${sqlUserHasProfilePicture('req."profilePicture"')} AND (${sqlUserHasActiveContractAt("req.id")})`,
            );
        }),
      )
      .setParameter("contractAt", contractAt)
      .getMany();
    const others = rels.map((r) => friendOf(r, inviterId));
    return others.sort((a, b) => a.id - b.id);
  }

  private async pickRandomUsersWithProfilePictures(
    count: number,
    excludeIds: number[],
    signedContract: boolean = true,
  ): Promise<User[]> {
    if (count <= 0) {
      return [];
    }
    const contractAt = new Date();
    const qb = this.userRepository
      .createQueryBuilder("u")
      .where(sqlUserHasProfilePicture('u."profilePicture"'));
    if (excludeIds.length > 0) {
      qb.andWhere("u.id NOT IN (:...ids)", { ids: excludeIds });
    }
    if (signedContract) {
      qb.andWhere(sqlUserHasActiveContractAt("u.id"), { contractAt });
    }
    return qb.orderBy("RANDOM()").take(count).getMany();
  }

  /**
   * Member profiles with avatars for the signup page, `count` of them at most.
   * Prefer accepted friends of the referrer, then random members with photos.
   */
  async getSignupSocialProof(
    referralCode?: string,
    count = SIGNUP_SOCIAL_PROOF_COUNT,
  ): Promise<User[]> {
    const minProfiles = Math.min(Math.max(count, 1), SIGNUP_SOCIAL_PROOF_MAX);
    const users: User[] = [];
    const usedIds: number[] = [];

    const trimmed = referralCode?.trim();
    // Same resolution the sign-up screen names its inviter by, so a reusable
    // share link gets that person's friends rather than falling back to random
    // members while the screen beside it says who invited you.
    const referrer = trimmed ? await this.resolveReferrer(trimmed) : null;
    const inviterId = referrer?.kind === "user" ? referrer.user.id : null;

    if (inviterId != null) {
      // The caller renders the inviter's own avatar first, so leave them out of
      // the fill rather than showing the same face twice.
      usedIds.push(inviterId);
      const friends = await this.findFriendUsersWithProfilePictures(inviterId);
      for (const u of friends) {
        if (users.length >= minProfiles) {
          break;
        }
        if (!usedIds.includes(u.id)) {
          usedIds.push(u.id);
          users.push(u);
        }
      }
    }

    const need = minProfiles - users.length;
    if (need > 0) {
      const fillers = await this.pickRandomUsersWithProfilePictures(
        need,
        usedIds,
      );
      users.push(...fillers);
    }

    return users;
  }
}
