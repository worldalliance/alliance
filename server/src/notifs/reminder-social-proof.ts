import { R } from "@alliance/common/result";
import { Logger } from "@nestjs/common";
import { secondsInHour } from "date-fns/constants";
import { shuffle } from "es-toolkit";
import { sqlIsLatestCompletion } from "src/actions/action-activity-status";
import {
  cohortNotifiesRecipientPersonally,
  ReminderGroupTimingMode,
  type ReminderGroup,
} from "src/actions/entities/reminder-group.entity";
import type { User } from "src/user/entities/user.entity";
import { acceptedFriendshipSql } from "src/user/friendship";
import {
  userActionNotifsEnabled_push,
  userActionNotifsEnabled_text,
} from "src/user/user.utils";
import type { EntityManager } from "typeorm";
import {
  ReminderSocialProofOutcome,
  type ActionEventNotif,
} from "./entities/action-event-notif.entity";
import {
  Experiment,
  ExperimentArm,
} from "./entities/experiment-assignment.entity";
import { assignExperimentArm } from "./experiment-assignment";
import type { ChannelTemplates } from "./missed-suite-notice";

export type SocialProofCandidate = {
  id: number;
  name: string;
  isFriend: boolean;
};

export type SocialProofPair = [SocialProofCandidate, SocialProofCandidate];

export type SocialProof = {
  outcome: ReminderSocialProofOutcome;
  actionIds: number[];
  pair: SocialProofPair | null;
};

export const SOCIAL_PROOF_SECONDS_FROM_DEADLINE = 3 * secondsInHour;

export function isSocialProofReminderGroup(
  group: Pick<
    ReminderGroup,
    | "timingMode"
    | "sendAtSecondsFromDeadline"
    | "timingAnchorEvent"
    | "cohortType"
  >,
): boolean {
  return (
    group.timingMode === ReminderGroupTimingMode.FromDeadline &&
    group.sendAtSecondsFromDeadline === SOCIAL_PROOF_SECONDS_FROM_DEADLINE &&
    !group.timingAnchorEvent &&
    cohortNotifiesRecipientPersonally(group.cohortType)
  );
}

/**
 * Null outside the experiment. Email always keeps the group's copy, so only
 * push and text can carry names.
 */
export async function assignSocialProofArm(
  em: EntityManager,
  params: { group: ReminderGroup; user: User },
): Promise<ExperimentArm | null> {
  const { group, user } = params;
  if (
    !isSocialProofReminderGroup(group) ||
    !(userActionNotifsEnabled_push(user) || userActionNotifsEnabled_text(user))
  ) {
    return null;
  }
  return assignExperimentArm(em, {
    experiment: Experiment.ReminderSocialProof,
    userId: user.id,
  });
}

/**
 * Named members other than the recipient whose latest terminal activity is a
 * completion on every one of `actionIds`.
 */
export function findSocialProofCandidates(
  em: EntityManager,
  params: { recipientId: number; actionIds: number[] },
): Promise<SocialProofCandidate[]> {
  return em.query<SocialProofCandidate[]>(
    `SELECT member.id, member.name, EXISTS (
       SELECT 1 FROM friend
       WHERE ${acceptedFriendshipSql("friend")}
         AND friend."lowUserId" = LEAST(member.id, $2)
         AND friend."highUserId" = GREATEST(member.id, $2)
     ) AS "isFriend"
     FROM action_activity activity
     JOIN "user" member ON member.id = activity."userId"
       AND member."deletedAt" IS NULL
       AND NOT member.anonymous
       AND btrim(member.name) <> ''
     WHERE activity."actionId" = ANY($1::int[])
       AND activity."userId" <> $2
       AND ${sqlIsLatestCompletion("activity")}
     GROUP BY member.id
     HAVING count(*) = cardinality($1::int[])`,
    [params.actionIds, params.recipientId],
  );
}

/** Two friends where possible, topped up with other completers. */
export function pickSocialProofPair(
  candidates: SocialProofCandidate[],
): SocialProofPair | null {
  const [first, second] = [
    ...shuffle(candidates.filter((candidate) => candidate.isFriend)),
    ...shuffle(candidates.filter((candidate) => !candidate.isFriend)),
  ];
  return second ? [first, second] : null;
}

const logger = new Logger("ReminderSocialProof");

export async function resolveSocialProof(
  em: EntityManager,
  params: {
    arm: ExperimentArm;
    reminderGroupId: number;
    recipientId: number;
    actionIds: number[];
  },
): Promise<SocialProof> {
  const { arm, reminderGroupId, recipientId, actionIds } = params;
  switch (arm) {
    case ExperimentArm.Control:
      return {
        outcome: ReminderSocialProofOutcome.Control,
        actionIds,
        pair: null,
      };
    case ExperimentArm.Variant:
      break;
    default:
      throw new Error(`unknown arm: ${arm satisfies never}`);
  }
  const candidates = await R.fromPromise(
    findSocialProofCandidates(em, { recipientId, actionIds }),
  );
  if (R.isFailure(candidates)) {
    logger.error(
      `social-proof lookup failed for reminder group ${reminderGroupId}, user ${recipientId}; sending standard copy: ${candidates.error.message}`,
      candidates.error.stack,
    );
    return {
      outcome: ReminderSocialProofOutcome.FallbackLookupFailed,
      actionIds,
      pair: null,
    };
  }
  const pair = pickSocialProofPair(candidates.value);
  return {
    outcome: pair
      ? ReminderSocialProofOutcome.NamesV1
      : ReminderSocialProofOutcome.FallbackTooFewCompleters,
    actionIds,
    pair,
  };
}

export function socialProofColumns(
  socialProof: SocialProof,
): Pick<
  ActionEventNotif,
  "socialProofOutcome" | "socialProofUserIds" | "socialProofActionIds"
> {
  return {
    socialProofOutcome: socialProof.outcome,
    socialProofUserIds:
      socialProof.pair?.map((candidate) => candidate.id) ?? null,
    socialProofActionIds: socialProof.actionIds,
  };
}

/**
 * Runs after the reminder claims its row, so a re-planned unsent row skips the
 * lookup. Without an arm, the group's copy and no columns. An arm implies push
 * or text is on, so recordDelivery always runs to store the columns.
 */
export async function socialProofDelivery(
  em: EntityManager,
  params: {
    arm: ExperimentArm | null;
    plan: { group: ReminderGroup; user: User };
    actionIds: number[];
    render: (template: string) => Promise<string>;
  },
): Promise<{
  columns: ReturnType<typeof socialProofColumns> | null;
  templates: ChannelTemplates;
  render: (template: string) => Promise<string>;
}> {
  const { arm, plan, actionIds, render } = params;
  const socialProof = arm
    ? await resolveSocialProof(em, {
        arm,
        reminderGroupId: plan.group.id,
        recipientId: plan.user.id,
        actionIds,
      })
    : null;
  const pair = socialProof?.pair ?? null;
  return {
    columns: socialProof && socialProofColumns(socialProof),
    templates: socialProofTemplates(plan.group, pair),
    render: (template) => renderWithNames({ template, pair, render }),
  };
}

const NAMES_KEYWORD = "#{names}";
// A private-use character, which neither reminder copy nor rendering produces.
const NAMES_PLACEHOLDER = "\uE002";

export function socialProofTemplates(
  group: ChannelTemplates,
  pair: SocialProofPair | null,
): ChannelTemplates {
  if (!pair) return group;
  return {
    pushMessage: `#{timeremaining} left for #{n} task#{s}. ${NAMES_KEYWORD} have already completed #{it|them}.`,
    textMessage: `You have #{timeremaining} left to complete #{n} Alliance task#{s}. ${NAMES_KEYWORD} have already completed #{it|them}. #{link}`,
    emailSubject: group.emailSubject,
    emailMessage: group.emailMessage,
  };
}

/** Fills `#{names}` after `render`, so names stay literal text. */
export async function renderWithNames(params: {
  template: string;
  pair: SocialProofPair | null;
  render: (template: string) => Promise<string>;
}): Promise<string> {
  const { template, pair, render } = params;
  if (!pair) return render(template);
  const names = pair.map((candidate) => candidate.name).join(" and ");
  const rendered = await render(
    template.replaceAll(NAMES_KEYWORD, NAMES_PLACEHOLDER),
  );
  return rendered.replaceAll(NAMES_PLACEHOLDER, () => names);
}
