import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PLANT_BASED_STUDY_CAMPAIGN_ID = 1;
const COHORT_BOUNDARY_PT = '2026-06-16 00:00:00 America/Los_Angeles';
const ANALYSIS_END_EXCLUSIVE_PT = '2026-07-03 00:00:00 America/Los_Angeles';

type Queryable = {
  connect(): Promise<void>;
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[] }>;
  end(): Promise<void>;
};

type CohortRow = {
  cohort: string;
  accounts_created: string;
  partial_profiles: string;
  email_verified: string;
  text_opt_in: string;
  signed_contracts: string;
  active_contracts: string;
  churned_contracts: string;
  suspended_before_signing: string;
  auto_suspended: string;
  completed_any_action: string;
  total_completed_actions: string;
  avg_completed_actions: string | null;
  median_hours_to_sign: string | null;
  avg_hours_to_sign: string | null;
  earliest_account_pt: string | null;
  latest_account_pt: string | null;
};

type CampaignRow = {
  id: string;
  name: string;
  code: string;
  created_at_pt: string;
  referred_accounts: string;
};

type SampleRow = {
  cohort: string;
  user_id: string;
  name: string;
  email: string;
  account_created_pt: string;
  first_signed_pt: string | null;
  latest_contract_type: string | null;
  latest_contract_event_pt: string | null;
  completed_actions: string;
};

type WeeklyCompletionRow = {
  cohort: string;
  period: string;
  signed_users: string;
  assigned_action_slots: string;
  assigned_actions_completed: string;
  users_with_assigned_completion: string;
  total_completion_events: string;
  total_distinct_completed_actions: string;
};

function readDbEnv(): Record<string, string> {
  const envPath = join(__dirname, '..', '.env');
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  const keys = new Set([
    'DB_HOST',
    'DB_PORT',
    'DB_USERNAME',
    'DB_PASSWORD',
    'DB_NAME',
  ]);
  const env: Record<string, string> = {};

  for (const line of lines) {
    const match = /^([A-Z_]+)=(.*)$/.exec(line);
    if (!match || !keys.has(match[1])) continue;
    env[match[1]] = match[2];
  }

  for (const key of keys) {
    if (!env[key]) {
      throw new Error(`Missing ${key} in server/.env`);
    }
  }

  return env;
}

function numberValue(value: string | null): number {
  if (value === null) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCount(value: string | null): string {
  return Math.round(numberValue(value)).toLocaleString();
}

function formatPercent(numerator: number, denominator: number): string {
  if (denominator === 0) return 'n/a';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

function formatHours(value: string | null): string {
  if (value === null) return 'n/a';
  const hours = numberValue(value);
  if (hours < 48) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function printCohort(row: CohortRow): void {
  const accounts = numberValue(row.accounts_created);
  const signed = numberValue(row.signed_contracts);
  const churned = numberValue(row.churned_contracts);
  const active = numberValue(row.active_contracts);

  console.log(`\n${row.cohort}`);
  console.log(`  accounts created: ${formatCount(row.accounts_created)}`);
  console.log(
    `  signed contracts: ${formatCount(row.signed_contracts)} (${formatPercent(
      signed,
      accounts,
    )} of accounts)`,
  );
  console.log(
    `  active now: ${formatCount(row.active_contracts)} (${formatPercent(
      active,
      signed,
    )} of signed)`,
  );
  console.log(
    `  churned: ${formatCount(row.churned_contracts)} (${formatPercent(
      churned,
      signed,
    )} of signed; ${formatPercent(churned, accounts)} of accounts)`,
  );
  console.log(
    `  auto-suspended churns: ${formatCount(row.auto_suspended)} (${formatPercent(
      numberValue(row.auto_suspended),
      churned,
    )} of churned)`,
  );
  console.log(
    `  email verified / text opt-in: ${formatCount(
      row.email_verified,
    )} / ${formatCount(row.text_opt_in)}`,
  );
  console.log(`  partial profiles: ${formatCount(row.partial_profiles)}`);
  console.log(
    `  completed any action: ${formatCount(
      row.completed_any_action,
    )} (${formatPercent(numberValue(row.completed_any_action), accounts)})`,
  );
  console.log(
    `  completed actions: ${formatCount(
      row.total_completed_actions,
    )} total, ${numberValue(row.avg_completed_actions).toFixed(1)} avg/account`,
  );
  console.log(
    `  time account -> first sign: median ${formatHours(
      row.median_hours_to_sign,
    )}, avg ${formatHours(row.avg_hours_to_sign)}`,
  );
  console.log(
    `  account window PT: ${row.earliest_account_pt ?? 'n/a'} -> ${
      row.latest_account_pt ?? 'n/a'
    }`,
  );
}

function printWeeklyCompletion(row: WeeklyCompletionRow): void {
  const assigned = numberValue(row.assigned_action_slots);
  const assignedCompleted = numberValue(row.assigned_actions_completed);
  const signedUsers = numberValue(row.signed_users);

  console.log(
    `  ${row.cohort}, ${row.period}: ${formatCount(
      row.assigned_actions_completed,
    )}/${formatCount(row.assigned_action_slots)} assigned action completions (${formatPercent(
      assignedCompleted,
      assigned,
    )}); ${formatCount(row.users_with_assigned_completion)}/${formatCount(
      row.signed_users,
    )} signed users completed an assigned action (${formatPercent(
      numberValue(row.users_with_assigned_completion),
      signedUsers,
    )}); total completion events ${formatCount(
      row.total_completion_events,
    )}, distinct user-action completions ${formatCount(
      row.total_distinct_completed_actions,
    )}`,
  );
}

async function main(): Promise<void> {
  const { Client } = (await import('pg')) as {
    Client: new (config: {
      host: string;
      port: number;
      user: string;
      password: string;
      database: string;
    }) => Queryable;
  };
  const env = readDbEnv();
  const client = new Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });

  await client.connect();

  const campaign = await client.query<CampaignRow>(
    `
      select
        c.id::text,
        c.name,
        c.code,
        to_char(c."createdAt" at time zone 'America/Los_Angeles', 'YYYY-MM-DD HH24:MI') as created_at_pt,
        count(u.id)::text as referred_accounts
      from campaign c
      left join "user" u on u."referredByCampaignId" = c.id
      where c.id = $1
      group by c.id, c.name, c.code, c."createdAt"
    `,
    [PLANT_BASED_STUDY_CAMPAIGN_ID],
  );

  const cohorts = await client.query<CohortRow>(
    `
      with plant_users as (
        select
          u.*,
          case
            when u."createdAt" < $2::timestamptz then 'Before Jun 16 PT'
            else 'Jun 16-Jul 2 PT'
          end as cohort
        from "user" u
        where u."referredByCampaignId" = $1
          and u."createdAt" < $3::timestamptz
      ),
      first_signed as (
        select "userId", min(date) as first_signed_at
        from contract_event
        where type = 'signed'
        group by "userId"
      ),
      latest_contract as (
        select "userId", type, date, automatic
        from (
          select
            ce.*,
            row_number() over (
              partition by "userId"
              order by date desc, id desc
            ) as rn
          from contract_event ce
        ) ranked
        where rn = 1
      ),
      action_counts as (
        select
          "userId",
          count(distinct "actionId") filter (where type = 'user_completed') as completed_actions
        from action_activity
        group by "userId"
      ),
      joined as (
        select
          pu.*,
          fs.first_signed_at,
          lc.type as latest_contract_type,
          lc.automatic as latest_contract_automatic,
          coalesce(ac.completed_actions, 0) as completed_actions
        from plant_users pu
        left join first_signed fs on fs."userId" = pu.id
        left join latest_contract lc on lc."userId" = pu.id
        left join action_counts ac on ac."userId" = pu.id
      )
      select
        cohort,
        count(*)::text as accounts_created,
        count(*) filter (where "isNotSignedUpPartialProfile")::text as partial_profiles,
        count(*) filter (where "emailVerified")::text as email_verified,
        count(*) filter (where "optInMmsId" is not null)::text as text_opt_in,
        count(*) filter (where first_signed_at is not null)::text as signed_contracts,
        count(*) filter (where latest_contract_type = 'signed')::text as active_contracts,
        count(*) filter (
          where first_signed_at is not null and latest_contract_type = 'suspended'
        )::text as churned_contracts,
        count(*) filter (
          where first_signed_at is null and latest_contract_type = 'suspended'
        )::text as suspended_before_signing,
        count(*) filter (
          where first_signed_at is not null
            and latest_contract_type = 'suspended'
            and latest_contract_automatic
        )::text as auto_suspended,
        count(*) filter (where completed_actions > 0)::text as completed_any_action,
        sum(completed_actions)::text as total_completed_actions,
        round(avg(completed_actions)::numeric, 2)::text as avg_completed_actions,
        round(
          percentile_cont(0.5) within group (
            order by extract(epoch from (first_signed_at - "createdAt")) / 3600
          ) filter (where first_signed_at is not null)::numeric,
          1
        )::text as median_hours_to_sign,
        round(
          avg(extract(epoch from (first_signed_at - "createdAt")) / 3600)
            filter (where first_signed_at is not null)::numeric,
          1
        )::text as avg_hours_to_sign,
        to_char(min("createdAt" at time zone 'America/Los_Angeles'), 'YYYY-MM-DD HH24:MI') as earliest_account_pt,
        to_char(max("createdAt" at time zone 'America/Los_Angeles'), 'YYYY-MM-DD HH24:MI') as latest_account_pt
      from joined
      group by cohort
      order by min("createdAt")
    `,
    [
      PLANT_BASED_STUDY_CAMPAIGN_ID,
      COHORT_BOUNDARY_PT,
      ANALYSIS_END_EXCLUSIVE_PT,
    ],
  );

  const samples = await client.query<SampleRow>(
    `
      with plant_users as (
        select
          u.*,
          case
            when u."createdAt" < $2::timestamptz then 'Before Jun 16 PT'
            else 'Jun 16-Jul 2 PT'
          end as cohort
        from "user" u
        where u."referredByCampaignId" = $1
          and u."createdAt" < $3::timestamptz
      ),
      first_signed as (
        select "userId", min(date) as first_signed_at
        from contract_event
        where type = 'signed'
        group by "userId"
      ),
      latest_contract as (
        select "userId", type, date
        from (
          select
            ce.*,
            row_number() over (
              partition by "userId"
              order by date desc, id desc
            ) as rn
          from contract_event ce
        ) ranked
        where rn = 1
      ),
      action_counts as (
        select
          "userId",
          count(distinct "actionId") filter (where type = 'user_completed') as completed_actions
        from action_activity
        group by "userId"
      )
      select
        pu.cohort,
        pu.id::text as user_id,
        pu.name,
        pu.email,
        to_char(pu."createdAt" at time zone 'America/Los_Angeles', 'YYYY-MM-DD HH24:MI') as account_created_pt,
        to_char(fs.first_signed_at at time zone 'America/Los_Angeles', 'YYYY-MM-DD HH24:MI') as first_signed_pt,
        lc.type::text as latest_contract_type,
        to_char(lc.date at time zone 'America/Los_Angeles', 'YYYY-MM-DD HH24:MI') as latest_contract_event_pt,
        coalesce(ac.completed_actions, 0)::text as completed_actions
      from plant_users pu
      left join first_signed fs on fs."userId" = pu.id
      left join latest_contract lc on lc."userId" = pu.id
      left join action_counts ac on ac."userId" = pu.id
      order by pu."createdAt", pu.id
    `,
    [
      PLANT_BASED_STUDY_CAMPAIGN_ID,
      COHORT_BOUNDARY_PT,
      ANALYSIS_END_EXCLUSIVE_PT,
    ],
  );

  const weeklyCompletions = await client.query<WeeklyCompletionRow>(
    `
      with plant_users as (
        select
          u.id,
          case
            when u."createdAt" < $2::timestamptz then 'Before Jun 16 PT'
            else 'Jun 16-Jul 2 PT'
          end as cohort
        from "user" u
        where u."referredByCampaignId" = $1
          and u."createdAt" < $3::timestamptz
      ),
      first_signed as (
        select "userId", min(date) as first_signed_at
        from contract_event
        where type = 'signed'
        group by "userId"
      ),
      signed_users as (
        select pu.id, pu.cohort, fs.first_signed_at
        from plant_users pu
        join first_signed fs on fs."userId" = pu.id
      ),
      periods as (
        select
          su.id as "userId",
          su.cohort,
          period_number,
          case
            when period_number = 1 then 'first signed week'
            else 'second signed week'
          end as period,
          su.first_signed_at + ((period_number - 1) * interval '7 days') as period_start,
          su.first_signed_at + (period_number * interval '7 days') as period_end
        from signed_users su
        cross join generate_series(1, 2) as period_number
      ),
      member_actions as (
        select
          a.id as "actionId",
          min(e.date) as member_action_at
        from "action" a
        join action_event e on e."actionId" = a.id
        where e."newStatus" = 'member_action'
          and not a."publicOnly"
          and not a.onboarding
          and not a.optional
        group by a.id
      ),
      assigned_actions as (
        select
          p.cohort,
          p.period_number,
          p.period,
          p."userId",
          ma."actionId"
        from periods p
        join member_actions ma
          on ma.member_action_at >= p.period_start
         and ma.member_action_at < p.period_end
        where (
          select ce.type
          from contract_event ce
          where ce."userId" = p."userId"
            and ce.date <= ma.member_action_at
          order by ce.date desc, ce.id desc
          limit 1
        ) = 'signed'
      ),
      assigned_summary as (
        select
          aa.cohort,
          aa.period_number,
          count(*)::text as assigned_action_slots,
          count(*) filter (where completed."userId" is not null)::text as assigned_actions_completed,
          count(distinct aa."userId") filter (where completed."userId" is not null)::text as users_with_assigned_completion
        from assigned_actions aa
        left join lateral (
          select distinct act."userId"
          from action_activity act
          where act."userId" = aa."userId"
            and act."actionId" = aa."actionId"
            and act.type = 'user_completed'
          limit 1
        ) completed on true
        group by aa.cohort, aa.period_number
      ),
      period_completion_summary as (
        select
          p.cohort,
          p.period_number,
          count(act.id)::text as total_completion_events,
          count(distinct (act."userId", act."actionId")) filter (where act.id is not null)::text as total_distinct_completed_actions
        from periods p
        left join action_activity act
          on act."userId" = p."userId"
         and act.type = 'user_completed'
         and act."createdAt" >= p.period_start
         and act."createdAt" < p.period_end
        group by p.cohort, p.period_number
      ),
      signed_user_counts as (
        select cohort, count(*)::text as signed_users
        from signed_users
        group by cohort
      ),
      cohort_periods as (
        select distinct
          p.cohort,
          p.period_number,
          p.period
        from periods p
      )
      select
        cp.cohort,
        cp.period,
        suc.signed_users,
        coalesce(asu.assigned_action_slots, '0') as assigned_action_slots,
        coalesce(asu.assigned_actions_completed, '0') as assigned_actions_completed,
        coalesce(asu.users_with_assigned_completion, '0') as users_with_assigned_completion,
        coalesce(pcs.total_completion_events, '0') as total_completion_events,
        coalesce(pcs.total_distinct_completed_actions, '0') as total_distinct_completed_actions
      from cohort_periods cp
      join signed_user_counts suc on suc.cohort = cp.cohort
      left join assigned_summary asu
        on asu.cohort = cp.cohort
       and asu.period_number = cp.period_number
      left join period_completion_summary pcs
        on pcs.cohort = cp.cohort
       and pcs.period_number = cp.period_number
      order by min(cp.period_number) over (partition by cp.cohort), cp.cohort
    `,
    [
      PLANT_BASED_STUDY_CAMPAIGN_ID,
      COHORT_BOUNDARY_PT,
      ANALYSIS_END_EXCLUSIVE_PT,
    ],
  );

  const campaignRow = campaign.rows[0];
  console.log('Plant-Based Study invite analysis');
  console.log(`Campaign id: ${PLANT_BASED_STUDY_CAMPAIGN_ID}`);
  console.log(
    `Campaign: ${campaignRow.name} (${campaignRow.code}), created ${campaignRow.created_at_pt} PT`,
  );
  console.log(`Cohort boundary: ${COHORT_BOUNDARY_PT}`);
  console.log(`Analysis end exclusive: ${ANALYSIS_END_EXCLUSIVE_PT}`);
  console.log(
    `Referred accounts: ${formatCount(campaignRow.referred_accounts)}`,
  );

  for (const row of cohorts.rows) {
    printCohort(row);
  }

  console.log('\nSigned-user weekly completion windows');
  console.log(
    '  Assigned action completions count non-optional, non-onboarding member actions launched while the user was active. Total completion events count all user_completed activities created inside that signed-user week.',
  );
  for (const row of weeklyCompletions.rows) {
    printWeeklyCompletion(row);
  }

  console.log('\nJoined users');
  for (const row of samples.rows) {
    console.log(
      `  ${row.cohort}: #${row.user_id} ${row.name} <${row.email}> | account ${row.account_created_pt} PT | signed ${
        row.first_signed_pt ?? 'no'
      } | latest ${row.latest_contract_type ?? 'none'} ${
        row.latest_contract_event_pt ?? ''
      } | completed actions ${row.completed_actions}`,
    );
  }

  await client.end();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
