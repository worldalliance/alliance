import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { signupUrl, withRef } from "src/search/approutes";
import { ContractEventType } from "src/user/entities/contract-event.entity";
import { OnetimeInviteStatus } from "src/user/entities/onetime-invite.entity";
import { ReferralSource } from "src/user/entities/user.entity";
import type { PaginatedList } from "src/utils/pagination.dto";
import type { Repository } from "src/utils/Repository";
import {
  InviteLinkKind,
  InviteLinkSort,
  type InviteLinkAdmin,
  type InviteLinkQueryDto,
} from "./dto/invite-link-admin.dto";
import { ShareUrl, ShareUrlKind } from "./entities/share-url.entity";

const ORDER: Record<InviteLinkSort, string> = {
  [InviteLinkSort.Newest]: '"createdAt" DESC, id',
  [InviteLinkSort.Oldest]: '"createdAt" ASC, id',
  [InviteLinkSort.MostUsed]: '"accountsCreated" DESC, "createdAt" DESC, id',
  [InviteLinkSort.LeastUsed]: '"accountsCreated" ASC, "createdAt" DESC, id',
};

const LINKS = `WITH links AS (
  SELECT 'individual:' || invite.id AS id, '${InviteLinkKind.Individual}' AS kind,
    invite.invitee AS label, invite.code, NULL::text AS url, invite."createdAt"
  FROM onetime_invite invite WHERE invite.status IN ('${OnetimeInviteStatus.LINK_UNUSED}', '${OnetimeInviteStatus.LINK_USED}')
  UNION ALL
  SELECT 'share:' || link.id, '${InviteLinkKind.MultiUse}',
    coalesce(link.label, owner.name, campaign.name, 'Invite link'), link.sid, link.url, link."createdAt"
  FROM share_url link LEFT JOIN "user" owner ON owner.id = link."userId" AND owner."deletedAt" IS NULL
  LEFT JOIN campaign ON campaign.id = link."campaignId" AND campaign."deletedAt" IS NULL
  WHERE link.kind = '${ShareUrlKind.Invite}' AND link."deletedAt" IS NULL
  UNION ALL
  SELECT 'member:' || owner.id, '${InviteLinkKind.MultiUse}', coalesce(owner.name, 'Member referral'), owner."referralCode", NULL::text, owner."createdAt"
  FROM "user" owner WHERE owner."deletedAt" IS NULL
  UNION ALL
  SELECT 'campaign:' || campaign.id, '${InviteLinkKind.MultiUse}', campaign.name, campaign.code, NULL::text, campaign."createdAt"
  FROM campaign WHERE campaign."deletedAt" IS NULL
), claims AS (
  SELECT account.id AS "userId", CASE
    WHEN account."referredByInviteId" IS NOT NULL THEN 'individual:' || account."referredByInviteId"
    WHEN account."referredByShareUrlId" IS NOT NULL THEN 'share:' || account."referredByShareUrlId"
    WHEN account."referredByCampaignId" IS NOT NULL THEN 'campaign:' || account."referredByCampaignId"
    WHEN account."referredById" IS NOT NULL AND account."referralSource" = '${ReferralSource.ReferralLink}' THEN 'member:' || account."referredById"
  END AS "linkId"
  FROM "user" account WHERE account."deletedAt" IS NULL
), metrics AS (
  SELECT claim."linkId", count(*)::int AS "accountsCreated",
    count(*) FILTER (WHERE EXISTS (SELECT 1 FROM contract_event event
      WHERE event."userId" = claim."userId" AND event."deletedAt" IS NULL AND event.type = '${ContractEventType.SIGNED}' AND event.date <= now()))::int AS "initialSigners",
    count(*) FILTER (WHERE (SELECT event.type FROM contract_event event
      WHERE event."userId" = claim."userId" AND event."deletedAt" IS NULL AND event.date <= now()
      ORDER BY event.date DESC, event.id DESC LIMIT 1) = '${ContractEventType.SIGNED}')::int AS "retainedSigners"
  FROM claims claim WHERE claim."linkId" IS NOT NULL GROUP BY claim."linkId"
), filtered AS (
  SELECT links.*, coalesce(metrics."accountsCreated", 0) AS "accountsCreated",
    coalesce(metrics."initialSigners", 0) AS "initialSigners",
    coalesce(metrics."retainedSigners", 0) AS "retainedSigners"
  FROM links LEFT JOIN metrics ON metrics."linkId" = links.id
  WHERE ($1::text IS NULL OR links.kind = $1)
)`;

type InviteLinkRow = Omit<InviteLinkAdmin, "url"> & {
  code: string | null;
  url: string | null;
};

@Injectable()
export class InviteLinkAdminService {
  constructor(
    @InjectRepository(ShareUrl)
    private readonly repository: Repository<ShareUrl>,
  ) {}

  async search(
    query: InviteLinkQueryDto,
  ): Promise<PaginatedList<InviteLinkAdmin>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const rows: InviteLinkRow[] = await this.repository.query(
      `${LINKS} SELECT * FROM filtered ORDER BY ${ORDER[query.sort]} LIMIT $2 OFFSET $3`,
      [query.kind ?? null, limit, (page - 1) * limit],
    );
    const [{ totalCount }]: { totalCount: number }[] =
      await this.repository.query(
        `${LINKS} SELECT count(*)::int AS "totalCount" FROM links WHERE ($1::text IS NULL OR kind = $1)`,
        [query.kind ?? null],
      );
    return {
      items: rows.map((row) => {
        const url = row.code ? withRef(signupUrl(true), row.code) : row.url;
        if (!url) throw new Error(`invite link ${row.id} has no URL`);
        return {
          id: row.id,
          kind: row.kind,
          label: row.label,
          url,
          createdAt: row.createdAt,
          accountsCreated: row.accountsCreated,
          initialSigners: row.initialSigners,
          retainedSigners: row.retainedSigners,
        };
      }),
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
    };
  }
}
