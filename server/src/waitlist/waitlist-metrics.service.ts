import { ActionActivityType } from "@alliance/common/actionActivity";
import { Injectable } from "@nestjs/common";
import { ContractEventType } from "src/user/entities/contract-event.entity";
import { inviteClaimantSql } from "src/user/invite-claim";
import { DataSource } from "typeorm";
import type { WaitlistEntryFilterDto } from "./dto/waitlist-entry-admin.dto";
import type {
  WaitlistInviteEmailCounts,
  WaitlistMetrics,
  WaitlistMetricsConversion,
  WaitlistMetricsSource,
  WaitlistMetricsWeek,
  WaitlistStatusCounts,
} from "./dto/waitlist-metrics.dto";
import {
  ENTRY_INVITE_CLAIMED_SQL,
  WaitlistEntryAdminService,
} from "./waitlist-entry-admin.service";

/**
 * `claim` holds one row per claimed invite of a cohort entry, and
 * `first_send` each cohort entry's first email the mail server accepted with
 * an invite in it.
 */
const COHORT_CTES = `
  claim AS (
    SELECT invite."waitlistEntryId" AS "entryId", invite."communityId",
      claimant.id AS "userId", claimant."createdAt" AS "claimedAt"
    FROM onetime_invite invite
    JOIN "user" claimant ON claimant."deletedAt" IS NULL
      AND ${inviteClaimantSql({ invite: "invite", claimant: "claimant" })}
    WHERE invite."waitlistEntryId" IN (SELECT id FROM cohort)
  ),
  first_send AS (
    SELECT recipient."entryId", min(recipient."acceptedAt") AS "sentAt"
    FROM waitlist_email_recipient recipient
    WHERE recipient."entryId" IN (SELECT id FROM cohort)
      AND recipient."deletedAt" IS NULL
      AND recipient."acceptedAt" IS NOT NULL
      AND recipient."inviteId" IS NOT NULL
    GROUP BY recipient."entryId"
  )`;

const COHORT_ENTRY = `waitlist_entry entry WHERE entry.id IN (SELECT id FROM cohort)`;

/** Selects from the CTEs, or continues them with a leading comma. */
type CohortQuery = <Row>(select: string) => Promise<Row[]>;

type NamedRow = { id: number | null; name: string | null };

const namedRef = (row: NamedRow) =>
  row.id === null || row.name === null ? null : { id: row.id, name: row.name };

@Injectable()
export class WaitlistMetricsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly entryService: WaitlistEntryAdminService,
  ) {}

  find(filter: WaitlistEntryFilterDto): Promise<WaitlistMetrics> {
    const [cohortSql, parameters] = this.entryService
      .filtered(filter)
      .select("entry.id", "id")
      .getQueryAndParameters();
    // One snapshot keeps every count to the same entries and claims.
    return this.dataSource.transaction("REPEATABLE READ", async (manager) => {
      const query: CohortQuery = (select) =>
        manager.query(
          `WITH cohort AS (${cohortSql}), ${COHORT_CTES} ${select}`,
          parameters,
        );
      return {
        status: await this.status(query),
        inviteEmails: await this.inviteEmails(query),
        weeks: await this.weeks(query),
        sources: await this.sources(query),
        conversions: await this.conversions(query),
      };
    });
  }

  private async status(query: CohortQuery): Promise<WaitlistStatusCounts> {
    const [row] = await query<WaitlistStatusCounts>(
      `SELECT count(*)::int AS entries,
         count(*) FILTER (WHERE entry."mobilizedAt" IS NULL)::int AS waiting,
         count(*) FILTER (WHERE entry."mobilizedAt" IS NOT NULL)::int AS mobilized,
         count(*) FILTER (WHERE ${ENTRY_INVITE_CLAIMED_SQL})::int AS "inviteClaimed",
         (SELECT count(*)::int FROM claim) AS "inviteClaims"
       FROM ${COHORT_ENTRY}`,
    );
    return row;
  }

  private async inviteEmails(
    query: CohortQuery,
  ): Promise<WaitlistInviteEmailCounts> {
    const [row] = await query<WaitlistInviteEmailCounts>(
      `, timed AS (
         SELECT min(claim."claimedAt") - first_send."sentAt" AS elapsed
         FROM first_send JOIN claim USING ("entryId")
         WHERE claim."claimedAt" >= first_send."sentAt"
         GROUP BY first_send."entryId", first_send."sentAt"
       )
       SELECT (SELECT count(*)::int FROM first_send) AS emailed,
         (SELECT count(DISTINCT "entryId")::int FROM claim
          WHERE "entryId" IN (SELECT "entryId" FROM first_send)) AS claimed,
         (SELECT count(*)::int FROM timed) AS "timedClaims",
         (SELECT percentile_cont(0.5) WITHIN GROUP (
            ORDER BY extract(epoch FROM elapsed)::float8
          ) FROM timed) AS "medianSecondsToClaim"`,
    );
    return row;
  }

  private weeks(query: CohortQuery): Promise<WaitlistMetricsWeek[]> {
    return query<WaitlistMetricsWeek>(
      `SELECT to_char(week, 'YYYY-MM-DD') AS "weekStart",
         sum(entries)::int AS entries, sum(claims)::int AS claims
       FROM (
         SELECT date_trunc('week', entry."createdAt" AT TIME ZONE 'UTC') AS week,
           1 AS entries, 0 AS claims
         FROM ${COHORT_ENTRY}
         UNION ALL
         SELECT date_trunc('week', claim."claimedAt" AT TIME ZONE 'UTC'), 0, 1
         FROM claim
       ) activity
       GROUP BY week
       ORDER BY week`,
    );
  }

  private async sources(query: CohortQuery): Promise<WaitlistMetricsSource[]> {
    const rows = await query<{
      organizationId: number | null;
      organizationName: string | null;
      linkId: number | null;
      channel: string | null;
      publishedAt: Date | null;
      entries: number;
      claims: number;
    }>(
      `SELECT entry."organizationId", organization.name AS "organizationName",
         link.id AS "linkId", link.channel, link."publishedAt",
         count(*)::int AS entries,
         coalesce(sum(entry_claim.claims), 0)::int AS claims
       FROM waitlist_entry entry
       LEFT JOIN (
         SELECT "entryId", count(*) AS claims FROM claim GROUP BY "entryId"
       ) entry_claim ON entry_claim."entryId" = entry.id
       LEFT JOIN campaign organization ON organization.id = entry."organizationId"
         AND organization."deletedAt" IS NULL
       LEFT JOIN waitlist_link link ON link.id = entry."sourceLinkId"
         AND link."deletedAt" IS NULL
       WHERE entry.id IN (SELECT id FROM cohort)
       GROUP BY entry."organizationId", organization.name, link.id
       ORDER BY organization.name NULLS LAST, entry."organizationId",
         link.channel NULLS FIRST, link.id`,
    );
    return rows.map((row) => ({
      organization: namedRef({
        id: row.organizationId,
        name: row.organizationName,
      }),
      link:
        row.linkId === null || row.channel === null
          ? null
          : {
              id: row.linkId,
              channel: row.channel,
              publishedAt: row.publishedAt,
            },
      entries: row.entries,
      claims: row.claims,
    }));
  }

  private async conversions(
    query: CohortQuery,
  ): Promise<WaitlistMetricsConversion[]> {
    const rows = await query<{
      organizationId: number | null;
      organizationName: string | null;
      groupId: number | null;
      groupName: string | null;
      claims: number;
      contractSigned: number;
      firstAction: number;
    }>(
      `SELECT entry."organizationId", organization.name AS "organizationName",
         claim."communityId" AS "groupId", community.name AS "groupName",
         count(*)::int AS claims,
         count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM contract_event event
           WHERE event."userId" = claim."userId"
             AND event."deletedAt" IS NULL
             AND event.type = '${ContractEventType.SIGNED}'
         ))::int AS "contractSigned",
         count(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM action_activity activity
           JOIN action ON action.id = activity."actionId"
           WHERE activity."userId" = claim."userId"
             AND activity.type = '${ActionActivityType.USER_COMPLETED}'
             AND activity."deletedAt" IS NULL
             AND action."deletedAt" IS NULL
             AND NOT action."isContractSigningAction"
         ))::int AS "firstAction"
       FROM claim
       JOIN waitlist_entry entry ON entry.id = claim."entryId"
       LEFT JOIN campaign organization ON organization.id = entry."organizationId"
         AND organization."deletedAt" IS NULL
       LEFT JOIN community ON community.id = claim."communityId"
         AND community."deletedAt" IS NULL
       GROUP BY entry."organizationId", organization.name,
         claim."communityId", community.name
       ORDER BY organization.name NULLS LAST, entry."organizationId",
         community.name NULLS LAST, claim."communityId"`,
    );
    return rows.map((row) => ({
      organization: namedRef({
        id: row.organizationId,
        name: row.organizationName,
      }),
      group: namedRef({ id: row.groupId, name: row.groupName }),
      claims: row.claims,
      contractSigned: row.contractSigned,
      firstAction: row.firstAction,
    }));
  }
}
