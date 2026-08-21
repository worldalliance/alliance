import { ActionActivityType } from "@alliance/common/actionActivity";
import { NestFactory } from "@nestjs/core";
import { getRepositoryToken } from "@nestjs/typeorm";
import "reflect-metadata";
import type { Repository } from "typeorm";
import { ActionActivity } from "../src/actions/entities/action-activity.entity";
import {
  ActionEvent,
  ActionStatus,
} from "../src/actions/entities/action-event.entity";
import { ActionFormAssignment } from "../src/actions/entities/action-form-assignment.entity";
import { ActionFormVariant } from "../src/actions/entities/action-form-variant.entity";
import { Action, parseAction } from "../src/actions/entities/action.entity";
import { AppModule } from "../src/app.module";
import { ActionEventRecipientService } from "../src/notifs/action-event-recipient.service";
import { FormResponse } from "../src/tasks/entities/formresponse.entity";
import { ContractEventType } from "../src/user/entities/contract-event.entity";
import {
  OnetimeInvite,
  OnetimeInviteStatus,
} from "../src/user/entities/onetime-invite.entity";
import { User } from "../src/user/entities/user.entity";

const ACTION_132_ID = 132;
const ACTION_133_ID = 133;
const ACTION_74_ID = 74;
const ACTION_133_FORM_IDS = [112, 113] as const;
const ACTION_IDS = [ACTION_132_ID, ACTION_133_ID, ACTION_74_ID] as const;
const DEFAULT_FRAMING_FOR_UNOVERRIDDEN_INVITES = "individual" as const;
const ACTION_74_INVITES_SENT_ANSWER_FIELD_ID = "field-1770338026569";
const INVITES_SENT_ANSWER_FIELD_ID = "field-1781048458496";
const ACTION_133_INVITE_SUCCESS_END = new Date("2026-07-01T06:59:59.999Z");

type InviteFraming = "group" | "individual";

type ManualInviteFramingOverride = {
  formId: (typeof ACTION_133_FORM_IDS)[number];
  invitingUserId?: number;
  invitingUserName?: string;
  groupInvites: number;
  individualInvites: number;
  groupAcceptedInvites?: number;
  individualAcceptedInvites?: number;
  note: string;
};

const MANUAL_INVITE_FRAMING_OVERRIDES: ManualInviteFramingOverride[] = [
  {
    formId: 112,
    invitingUserName: "Stefan Murphy",
    groupInvites: 14,
    individualInvites: 0,
    note: "Manual assumption: discount Stefan Murphy's 14 form 112 invites because they were to a group, not individuals.",
  },
  {
    formId: 113,
    invitingUserName: "Victoria Torrie Jacobs",
    groupInvites: 232,
    individualInvites: 4,
    note: "Manual assumption: discount 232 of Victoria Torrie Jacobs's form 113 invites because they were to a group; count 4 as individual invites.",
  },
];

type CompletionState = "completed" | "incomplete";

type ActionRoster = {
  actionId: number;
  actionName: string;
  userIds: Set<number>;
};

type FormRoster = ActionRoster & {
  formId: number;
  label: string;
};

type LatestTerminal = {
  type:
    | ActionActivityType.USER_COMPLETED
    | ActionActivityType.USER_WONT_COMPLETE;
  createdAt: Date;
};

type PairStats = {
  labelA: string;
  labelB: string;
  overlapUserIds: number[];
  completedBoth: number[];
  aCompletedBIncomplete: number[];
  aIncompleteBCompleted: number[];
  incompleteBoth: number[];
};

type InviteComparisonStats = {
  label: string;
  comparedUserIds: number[];
  action74Total: number;
  action133Total: number;
  action74Average: number;
  action133Average: number;
  perPersonDeltaAverage: number;
  increased: number[];
  decreased: number[];
  unchanged: number[];
};

type InviteStatusCounts = Record<OnetimeInviteStatus, number>;

type InviterInviteStats = {
  formId: number;
  userId: number;
  userName: string;
  rawInvitesSent: number;
  inviteLinkRows: number;
  acceptedInvites: number;
  signedContractInvites: number;
  statusCounts: InviteStatusCounts;
  inviteIds: number[];
  override?: ManualInviteFramingOverride;
};

type FramingBucket = {
  formId: number;
  framing: InviteFraming;
  rawInvitesSent: number;
  discountedGroupInvites: number;
  exactAcceptedInvites: number;
  exactSignedContractInvites: number;
  minAcceptedInvites: number;
  maxAcceptedInvites: number;
  unknownAcceptedInvites: number;
};

type InviteSuccessStats = {
  label: string;
  inviterIds: number[];
  inviteIds: number[];
  created: number;
  joined: number;
  signedContracts: number;
  linkUnused: number;
  requestPending: number;
  requestRejected: number;
};

type SelfReportedVsActualInvitesStats = {
  label: string;
  assignedUserCount: number;
  selfReportedUsers: number;
  selfReportedInvites: number;
  actualInviteRows: number;
  difference: number;
  ratio: number | null;
};

type GrowthActionSegmentStats = {
  label: string;
  userIds: number[];
  selfReportedUsers: number;
  selfReportedInvites: number;
  actualInviteRows: number;
};

function getMemberActionEvent(action: Action): ActionEvent {
  const event = action.events
    .slice()
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .find((candidate) => candidate.newStatus === ActionStatus.MemberAction);
  if (!event) {
    throw new Error(`Action ${action.id} does not have a member_action event`);
  }
  return event;
}

function setIntersection(a: Set<number>, b: Set<number>): number[] {
  return [...a].filter((id) => b.has(id)).sort((x, y) => x - y);
}

function completionState(params: {
  latestTerminalByUserAction: Map<string, LatestTerminal>;
  userId: number;
  actionId: number;
}): CompletionState {
  const terminal = params.latestTerminalByUserAction.get(
    `${params.userId}:${params.actionId}`,
  );
  return terminal?.type === ActionActivityType.USER_COMPLETED
    ? "completed"
    : "incomplete";
}

function pairStats(params: {
  labelA: string;
  labelB: string;
  rosterA: Set<number>;
  rosterB: Set<number>;
  actionAId: number;
  actionBId: number;
  latestTerminalByUserAction: Map<string, LatestTerminal>;
}): PairStats {
  const overlapUserIds = setIntersection(params.rosterA, params.rosterB);
  const completedBoth: number[] = [];
  const aCompletedBIncomplete: number[] = [];
  const aIncompleteBCompleted: number[] = [];
  const incompleteBoth: number[] = [];

  for (const userId of overlapUserIds) {
    const stateA = completionState({
      latestTerminalByUserAction: params.latestTerminalByUserAction,
      userId,
      actionId: params.actionAId,
    });
    const stateB = completionState({
      latestTerminalByUserAction: params.latestTerminalByUserAction,
      userId,
      actionId: params.actionBId,
    });

    if (stateA === "completed" && stateB === "completed") {
      completedBoth.push(userId);
    } else if (stateA === "completed" && stateB === "incomplete") {
      aCompletedBIncomplete.push(userId);
    } else if (stateA === "incomplete" && stateB === "completed") {
      aIncompleteBCompleted.push(userId);
    } else {
      incompleteBoth.push(userId);
    }
  }

  return {
    labelA: params.labelA,
    labelB: params.labelB,
    overlapUserIds,
    completedBoth,
    aCompletedBIncomplete,
    aIncompleteBCompleted,
    incompleteBoth,
  };
}

function pct(part: number, whole: number): string {
  if (whole === 0) return "n/a";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

function pctRange(minPart: number, maxPart: number, whole: number): string {
  if (whole === 0) return "n/a";
  const min = pct(minPart, whole);
  const max = pct(maxPart, whole);
  return min === max ? min : `${min} - ${max}`;
}

function printIds(label: string, ids: number[]): void {
  console.log(`${label} (${ids.length}): ${ids.join(", ") || "(none)"}`);
}

function numberAnswer(
  answers: Record<string, unknown>,
  fieldId: string,
): number {
  const value = answers[fieldId];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function optionalNumberAnswer(
  answers: Record<string, unknown>,
  fieldId: string,
): number | null {
  const value = answers[fieldId];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function printPairStats(stats: PairStats): void {
  const total = stats.overlapUserIds.length;
  console.log(`\n${stats.labelA} vs ${stats.labelB}`);
  console.log(`overlapping members: ${total}`);
  console.log(
    `${stats.labelA} completion rate on overlap: ${pct(
      stats.completedBoth.length + stats.aCompletedBIncomplete.length,
      total,
    )}`,
  );
  console.log(
    `${stats.labelB} completion rate on overlap: ${pct(
      stats.completedBoth.length + stats.aIncompleteBCompleted.length,
      total,
    )}`,
  );
  console.table([
    {
      [`${stats.labelA} \\ ${stats.labelB}`]: "completed",
      completed: stats.completedBoth.length,
      incomplete: stats.aCompletedBIncomplete.length,
    },
    {
      [`${stats.labelA} \\ ${stats.labelB}`]: "incomplete",
      completed: stats.aIncompleteBCompleted.length,
      incomplete: stats.incompleteBoth.length,
    },
  ]);
  printIds("overlap member IDs", stats.overlapUserIds);
  printIds("completed both", stats.completedBoth);
  printIds(
    `${stats.labelA} completed / ${stats.labelB} incomplete`,
    stats.aCompletedBIncomplete,
  );
  printIds(
    `${stats.labelA} incomplete / ${stats.labelB} completed`,
    stats.aIncompleteBCompleted,
  );
  printIds("incomplete both", stats.incompleteBoth);
}

function inviteComparisonStats(params: {
  label: string;
  candidateUserIds: number[];
  action74InvitesByUser: Map<number, number>;
  action133InvitesByUser: Map<number, number>;
}): InviteComparisonStats {
  const comparedUserIds = params.candidateUserIds
    .filter(
      (userId) =>
        params.action74InvitesByUser.has(userId) &&
        params.action133InvitesByUser.has(userId),
    )
    .sort((a, b) => a - b);
  const action74Total = comparedUserIds.reduce(
    (sum, userId) => sum + params.action74InvitesByUser.get(userId)!,
    0,
  );
  const action133Total = comparedUserIds.reduce(
    (sum, userId) => sum + params.action133InvitesByUser.get(userId)!,
    0,
  );
  const increased: number[] = [];
  const decreased: number[] = [];
  const unchanged: number[] = [];
  for (const userId of comparedUserIds) {
    const delta =
      params.action133InvitesByUser.get(userId)! -
      params.action74InvitesByUser.get(userId)!;
    if (delta > 0) {
      increased.push(userId);
    } else if (delta < 0) {
      decreased.push(userId);
    } else {
      unchanged.push(userId);
    }
  }
  const n = comparedUserIds.length;
  return {
    label: params.label,
    comparedUserIds,
    action74Total,
    action133Total,
    action74Average: n === 0 ? 0 : action74Total / n,
    action133Average: n === 0 ? 0 : action133Total / n,
    perPersonDeltaAverage: n === 0 ? 0 : (action133Total - action74Total) / n,
    increased,
    decreased,
    unchanged,
  };
}

function printInviteComparisonStats(stats: InviteComparisonStats): void {
  console.log(`\n${stats.label}`);
  console.log(
    `paired numeric invite-count respondents: ${stats.comparedUserIds.length}`,
  );
  console.log(`action 74 total invites: ${stats.action74Total}`);
  console.log(`action 133 total invites: ${stats.action133Total}`);
  console.log(
    `action 74 avg invites/person: ${stats.action74Average.toFixed(2)}`,
  );
  console.log(
    `action 133 avg invites/person: ${stats.action133Average.toFixed(2)}`,
  );
  console.log(
    `avg change/person, 133 minus 74: ${stats.perPersonDeltaAverage.toFixed(2)}`,
  );
  console.log(
    `increased: ${stats.increased.length}, decreased: ${stats.decreased.length}, unchanged: ${stats.unchanged.length}`,
  );
  printIds("paired respondent IDs", stats.comparedUserIds);
  printIds("increased IDs", stats.increased);
  printIds("decreased IDs", stats.decreased);
  printIds("unchanged IDs", stats.unchanged);
}

function printAction132To133DropoffStats(params: {
  label: string;
  pair: PairStats;
}): void {
  const { label, pair } = params;
  const action132Completers =
    pair.completedBoth.length + pair.aCompletedBIncomplete.length;
  const action133Completers =
    pair.completedBoth.length + pair.aIncompleteBCompleted.length;
  console.log(`\n${label}`);
  console.log(`overlapping assigned members: ${pair.overlapUserIds.length}`);
  console.log(`completed both: ${pair.completedBoth.length}`);
  console.log(
    `completed action 132 but did not complete action 133: ${pair.aCompletedBIncomplete.length}`,
  );
  console.log(
    `completed action 133 but did not complete action 132: ${pair.aIncompleteBCompleted.length}`,
  );
  console.log(`completed neither: ${pair.incompleteBoth.length}`);
  console.log(
    `action 132 completion rate in overlap: ${pct(
      action132Completers,
      pair.overlapUserIds.length,
    )}`,
  );
  console.log(
    `action 133 completion rate in overlap: ${pct(
      action133Completers,
      pair.overlapUserIds.length,
    )}`,
  );
  console.log(
    `dropoff rate among action 132 completers: ${pct(
      pair.aCompletedBIncomplete.length,
      action132Completers,
    )}`,
  );
  console.log(
    `action 133 completion rate among action 132 completers: ${pct(
      pair.completedBoth.length,
      action132Completers,
    )}`,
  );
  console.log(
    `dropoff as share of all overlapping members: ${pct(
      pair.aCompletedBIncomplete.length,
      pair.overlapUserIds.length,
    )}`,
  );
  printIds(
    "completed action 132 but did not complete action 133 IDs",
    pair.aCompletedBIncomplete,
  );
  printIds("completed both IDs", pair.completedBoth);
  printIds("completed neither IDs", pair.incompleteBoth);
}

function emptyInviteStatusCounts(): InviteStatusCounts {
  return {
    [OnetimeInviteStatus.REQUEST_PENDING]: 0,
    [OnetimeInviteStatus.REQUEST_REJECTED]: 0,
    [OnetimeInviteStatus.LINK_UNUSED]: 0,
    [OnetimeInviteStatus.LINK_USED]: 0,
  };
}

function getManualOverride(params: {
  formId: number;
  userId: number;
  userName: string;
}): ManualInviteFramingOverride | undefined {
  const normalizeName = (name: string) =>
    name.replaceAll('"', "").replace(/\s+/g, " ").trim();
  return MANUAL_INVITE_FRAMING_OVERRIDES.find((override) => {
    if (override.formId !== params.formId) {
      return false;
    }
    if (override.invitingUserId !== undefined) {
      return override.invitingUserId === params.userId;
    }
    return (
      override.invitingUserName !== undefined &&
      normalizeName(override.invitingUserName) ===
        normalizeName(params.userName)
    );
  });
}

function assertValidOverride(override: ManualInviteFramingOverride): void {
  const acceptedGroup = override.groupAcceptedInvites;
  if (acceptedGroup !== undefined && acceptedGroup > override.groupInvites) {
    throw new Error(
      `${override.invitingUserName ?? override.invitingUserId} has more accepted group invites than group invites`,
    );
  }
  const acceptedIndividual = override.individualAcceptedInvites;
  if (
    acceptedIndividual !== undefined &&
    acceptedIndividual > override.individualInvites
  ) {
    throw new Error(
      `${override.invitingUserName ?? override.invitingUserId} has more accepted individual invites than individual invites`,
    );
  }
}

function makeFramingBucket(
  formId: number,
  framing: InviteFraming,
): FramingBucket {
  return {
    formId,
    framing,
    rawInvitesSent: 0,
    discountedGroupInvites: 0,
    exactAcceptedInvites: 0,
    exactSignedContractInvites: 0,
    minAcceptedInvites: 0,
    maxAcceptedInvites: 0,
    unknownAcceptedInvites: 0,
  };
}

function addExactBucketCounts(
  bucket: FramingBucket,
  rawInvitesSent: number,
  acceptedInvites: number,
  signedContractInvites: number,
): void {
  bucket.rawInvitesSent += rawInvitesSent;
  bucket.exactAcceptedInvites += acceptedInvites;
  bucket.exactSignedContractInvites += signedContractInvites;
  bucket.minAcceptedInvites += acceptedInvites;
  bucket.maxAcceptedInvites += acceptedInvites;
}

function addSplitOverrideCounts(
  bucketsByKey: Map<string, FramingBucket>,
  stats: InviterInviteStats,
  override: ManualInviteFramingOverride,
): void {
  assertValidOverride(override);

  const key = (framing: InviteFraming) => `${stats.formId}:${framing}`;
  const groupBucket = bucketsByKey.get(key("group"))!;
  const individualBucket = bucketsByKey.get(key("individual"))!;
  const groupInvites = override.groupInvites;
  const individualInvites = override.individualInvites;
  const overrideTotal = groupInvites + individualInvites;

  if (overrideTotal !== stats.rawInvitesSent) {
    console.warn(
      `WARNING: override for ${stats.userName} form ${stats.formId} accounts for ${overrideTotal} invites, but raw data has ${stats.rawInvitesSent}.`,
    );
  }

  const acceptedGroup = override.groupAcceptedInvites;
  const acceptedIndividual = override.individualAcceptedInvites;
  if (acceptedGroup !== undefined || acceptedIndividual !== undefined) {
    if (acceptedGroup === undefined || acceptedIndividual === undefined) {
      throw new Error(
        `Override for ${stats.userName} form ${stats.formId} must set both groupAcceptedInvites and individualAcceptedInvites, or neither.`,
      );
    }
    if (acceptedGroup + acceptedIndividual !== stats.acceptedInvites) {
      console.warn(
        `WARNING: accepted override for ${stats.userName} form ${stats.formId} accounts for ${acceptedGroup + acceptedIndividual} accepted invites, but raw data has ${stats.acceptedInvites}.`,
      );
    }
    groupBucket.discountedGroupInvites += groupInvites;
    addExactBucketCounts(
      individualBucket,
      individualInvites,
      acceptedIndividual,
      stats.signedContractInvites,
    );
    return;
  }

  if (groupInvites === 0) {
    addExactBucketCounts(
      individualBucket,
      individualInvites,
      stats.acceptedInvites,
      stats.signedContractInvites,
    );
    return;
  }
  if (individualInvites === 0) {
    groupBucket.discountedGroupInvites += groupInvites;
    return;
  }

  groupBucket.discountedGroupInvites += groupInvites;
  individualBucket.rawInvitesSent += individualInvites;
  individualBucket.unknownAcceptedInvites += stats.acceptedInvites;
  individualBucket.exactSignedContractInvites += stats.signedContractInvites;
  individualBucket.minAcceptedInvites += Math.max(
    0,
    stats.acceptedInvites - groupInvites,
  );
  individualBucket.maxAcceptedInvites += Math.min(
    individualInvites,
    stats.acceptedInvites,
  );
}

function printInviteFramingStats(params: {
  actionWindowStart: Date;
  actionWindowEnd: Date;
  inviterStats: InviterInviteStats[];
}): void {
  const bucketsByKey = new Map<string, FramingBucket>();
  for (const formId of ACTION_133_FORM_IDS) {
    for (const framing of ["group", "individual"] as const) {
      bucketsByKey.set(
        `${formId}:${framing}`,
        makeFramingBucket(formId, framing),
      );
    }
  }

  for (const stats of params.inviterStats) {
    if (stats.override) {
      addSplitOverrideCounts(bucketsByKey, stats, stats.override);
      continue;
    }
    const bucket = bucketsByKey.get(
      `${stats.formId}:${DEFAULT_FRAMING_FOR_UNOVERRIDDEN_INVITES}`,
    )!;
    addExactBucketCounts(
      bucket,
      stats.rawInvitesSent,
      stats.acceptedInvites,
      stats.signedContractInvites,
    );
  }

  console.log("\n=== Action 133 form invite conversion analysis ===");
  console.log(
    `invite window: ${params.actionWindowStart.toISOString()} to ${params.actionWindowEnd.toISOString()}`,
  );
  console.log(
    `accepted definition: onetime_invite.status = ${OnetimeInviteStatus.LINK_USED}`,
  );
  console.log(
    `signed-contract definition: invited user has a signed contract event by ${params.actionWindowEnd.toISOString()}`,
  );
  console.log(
    `default framing for users without a manual override: ${DEFAULT_FRAMING_FOR_UNOVERRIDDEN_INVITES}`,
  );

  console.log("\nManual framing overrides");
  console.table(
    MANUAL_INVITE_FRAMING_OVERRIDES.map((override) => ({
      formId: override.formId,
      invitingUser: override.invitingUserName ?? override.invitingUserId,
      groupInvites: override.groupInvites,
      individualInvites: override.individualInvites,
      groupAcceptedInvites: override.groupAcceptedInvites ?? "(not specified)",
      individualAcceptedInvites:
        override.individualAcceptedInvites ?? "(not specified)",
      note: override.note,
    })),
  );

  console.log("\nPer-inviter raw invite rows");
  console.table(
    params.inviterStats.map((stats) => ({
      formId: stats.formId,
      userId: stats.userId,
      userName: stats.userName,
      rawInvitesSent: stats.rawInvitesSent,
      inviteLinkRows: stats.inviteLinkRows,
      acceptedInvites: stats.acceptedInvites,
      signedContractInvites: stats.signedContractInvites,
      requestPending: stats.statusCounts.request_pending,
      requestRejected: stats.statusCounts.request_rejected,
      linkUnused: stats.statusCounts.link_unused,
      linkUsed: stats.statusCounts.link_used,
      manualOverride: stats.override ? "yes" : "no",
      inviteIds: stats.inviteIds.join(", "),
    })),
  );

  console.log("\nPer-form raw totals");
  console.table(
    ACTION_133_FORM_IDS.map((formId) => {
      const rows = params.inviterStats.filter(
        (stats) => stats.formId === formId,
      );
      const selfReportedRawInvites = rows.reduce(
        (sum, stats) => sum + stats.rawInvitesSent,
        0,
      );
      const inviteLinkRows = rows.reduce(
        (sum, stats) => sum + stats.inviteLinkRows,
        0,
      );
      const groupBucket = bucketsByKey.get(`${formId}:group`)!;
      const individualBucket = bucketsByKey.get(`${formId}:individual`)!;
      return {
        formId,
        selfReportedRawInvites,
        discountedGroupInvites: groupBucket.discountedGroupInvites,
        countedIndividualInvites: individualBucket.rawInvitesSent,
        inviteLinkRows,
        acceptedInvitesRange: `${individualBucket.minAcceptedInvites} - ${individualBucket.maxAcceptedInvites}`,
        acceptedPctRange: pctRange(
          individualBucket.minAcceptedInvites,
          individualBucket.maxAcceptedInvites,
          individualBucket.rawInvitesSent,
        ),
        signedContracts: individualBucket.exactSignedContractInvites,
        signedContractPct: pct(
          individualBucket.exactSignedContractInvites,
          individualBucket.rawInvitesSent,
        ),
        invitersWithAnyInvites: rows.length,
      };
    }),
  );

  console.log("\nFraming totals and acceptance rates");
  console.table(
    [...bucketsByKey.values()].map((bucket) => ({
      formId: bucket.formId,
      framing: bucket.framing,
      countedIndividualInvites: bucket.rawInvitesSent,
      discountedGroupInvites: bucket.discountedGroupInvites,
      exactAcceptedInvites:
        bucket.unknownAcceptedInvites > 0
          ? `${bucket.exactAcceptedInvites} exact + ${bucket.unknownAcceptedInvites} ambiguous`
          : bucket.exactAcceptedInvites,
      signedContracts: bucket.exactSignedContractInvites,
      signedContractPct: pct(
        bucket.exactSignedContractInvites,
        bucket.rawInvitesSent,
      ),
      acceptedInvitesRange: `${bucket.minAcceptedInvites} - ${bucket.maxAcceptedInvites}`,
      acceptedPctRange: pctRange(
        bucket.minAcceptedInvites,
        bucket.maxAcceptedInvites,
        bucket.rawInvitesSent,
      ),
    })),
  );
}

function inviteSignedContractBy(
  invite: OnetimeInvite,
  conversionEnd: Date,
): boolean {
  return (
    invite.invitedUser?.contractEvents?.some(
      (event) =>
        event.type === ContractEventType.SIGNED && event.date <= conversionEnd,
    ) ?? false
  );
}

function inviteSuccessStats(params: {
  label: string;
  inviterIds: number[];
  invites: OnetimeInvite[];
  conversionEnd: Date;
}): InviteSuccessStats {
  const inviterIdSet = new Set(params.inviterIds);
  const relevantInvites = params.invites.filter((invite) =>
    inviterIdSet.has(invite.invitingUser.id),
  );
  const statusCounts = emptyInviteStatusCounts();
  for (const invite of relevantInvites) {
    statusCounts[invite.status] += 1;
  }
  return {
    label: params.label,
    inviterIds: [...inviterIdSet].sort((a, b) => a - b),
    inviteIds: relevantInvites.map((invite) => invite.id).sort((a, b) => a - b),
    created: relevantInvites.length,
    joined: statusCounts[OnetimeInviteStatus.LINK_USED],
    signedContracts: relevantInvites.filter((invite) =>
      inviteSignedContractBy(invite, params.conversionEnd),
    ).length,
    linkUnused: statusCounts[OnetimeInviteStatus.LINK_UNUSED],
    requestPending: statusCounts[OnetimeInviteStatus.REQUEST_PENDING],
    requestRejected: statusCounts[OnetimeInviteStatus.REQUEST_REJECTED],
  };
}

function printInviteSuccessStats(stats: InviteSuccessStats): void {
  console.log(`\n${stats.label}`);
  console.log(`eligible non-staff inviters: ${stats.inviterIds.length}`);
  console.log(`invites created: ${stats.created}`);
  console.log(`joined via invite: ${stats.joined}`);
  console.log(
    `account-created conversion rate: ${pct(stats.joined, stats.created)}`,
  );
  console.log(`signed contracts: ${stats.signedContracts}`);
  console.log(
    `contract-signed conversion rate: ${pct(stats.signedContracts, stats.created)}`,
  );
  console.log(`link unused: ${stats.linkUnused}`);
  console.log(`request pending: ${stats.requestPending}`);
  console.log(`request rejected: ${stats.requestRejected}`);
  printIds("inviter IDs", stats.inviterIds);
  printIds("invite IDs", stats.inviteIds);
}

function selfReportedVsActualInvitesStats(params: {
  label: string;
  assignedUserIds: number[];
  selfReportedInvitesByUser: Map<number, number>;
  actualInvites: OnetimeInvite[];
}): SelfReportedVsActualInvitesStats {
  const assignedUserIdSet = new Set(params.assignedUserIds);
  const selfReportedEntries = [
    ...params.selfReportedInvitesByUser.entries(),
  ].filter(([userId]) => assignedUserIdSet.has(userId));
  const selfReportedInvites = selfReportedEntries.reduce(
    (sum, [, count]) => sum + count,
    0,
  );
  const actualInviteRows = params.actualInvites.filter((invite) =>
    assignedUserIdSet.has(invite.invitingUser.id),
  ).length;
  return {
    label: params.label,
    assignedUserCount: assignedUserIdSet.size,
    selfReportedUsers: selfReportedEntries.length,
    selfReportedInvites,
    actualInviteRows,
    difference: actualInviteRows - selfReportedInvites,
    ratio:
      selfReportedInvites === 0 ? null : actualInviteRows / selfReportedInvites,
  };
}

function printSelfReportedVsActualInvitesStats(
  stats: SelfReportedVsActualInvitesStats,
): void {
  console.log(`\n${stats.label}`);
  console.log(`assigned non-staff users: ${stats.assignedUserCount}`);
  console.log(
    `users with numeric self-report invite counts: ${stats.selfReportedUsers}`,
  );
  console.log(`self-reported invites: ${stats.selfReportedInvites}`);
  console.log(`actual invite rows created: ${stats.actualInviteRows}`);
  console.log(
    `actual minus self-reported: ${stats.difference >= 0 ? "+" : ""}${stats.difference}`,
  );
  console.log(
    `actual / self-reported: ${stats.ratio === null ? "n/a" : stats.ratio.toFixed(2)}`,
  );
}

function growthActionSegmentStats(params: {
  label: string;
  userIds: number[];
  selfReportedInvitesByUser: Map<number, number>;
  actualInvites: OnetimeInvite[];
}): GrowthActionSegmentStats {
  const userIdSet = new Set(params.userIds);
  const selfReportedEntries = [
    ...params.selfReportedInvitesByUser.entries(),
  ].filter(([userId]) => userIdSet.has(userId));
  return {
    label: params.label,
    userIds: [...userIdSet].sort((a, b) => a - b),
    selfReportedUsers: selfReportedEntries.length,
    selfReportedInvites: selfReportedEntries.reduce(
      (sum, [, count]) => sum + count,
      0,
    ),
    actualInviteRows: params.actualInvites.filter((invite) =>
      userIdSet.has(invite.invitingUser.id),
    ).length,
  };
}

function printGrowthActionSegmentStats(stats: GrowthActionSegmentStats): void {
  console.log(`\n${stats.label}`);
  console.log(`assigned users: ${stats.userIds.length}`);
  console.log(
    `users with numeric self-report invite counts: ${stats.selfReportedUsers}`,
  );
  console.log(`self-reported invites: ${stats.selfReportedInvites}`);
  console.log(
    `self-reported invites/person across assigned users: ${(
      stats.selfReportedInvites / stats.userIds.length
    ).toFixed(2)}`,
  );
  console.log(`actual invite rows created: ${stats.actualInviteRows}`);
  console.log(
    `actual invite rows/person across assigned users: ${(
      stats.actualInviteRows / stats.userIds.length
    ).toFixed(2)}`,
  );
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });

  try {
    const actionRepo = app.get<Repository<Action>>(getRepositoryToken(Action));
    const activityRepo = app.get<Repository<ActionActivity>>(
      getRepositoryToken(ActionActivity),
    );
    const assignmentRepo = app.get<Repository<ActionFormAssignment>>(
      getRepositoryToken(ActionFormAssignment),
    );
    const variantRepo = app.get<Repository<ActionFormVariant>>(
      getRepositoryToken(ActionFormVariant),
    );
    const formResponseRepo = app.get<Repository<FormResponse>>(
      getRepositoryToken(FormResponse),
    );
    const inviteRepo = app.get<Repository<OnetimeInvite>>(
      getRepositoryToken(OnetimeInvite),
    );
    const userRepo = app.get<Repository<User>>(getRepositoryToken(User));
    const recipientService = app.get(ActionEventRecipientService);

    const actions = await actionRepo
      .find({
        where: ACTION_IDS.map((id) => ({ id })),
        relations: { events: true },
      })
      .then((rows) => rows.map(parseAction));
    const actionById = new Map(actions.map((action) => [action.id, action]));
    for (const actionId of ACTION_IDS) {
      if (!actionById.has(actionId)) {
        throw new Error(`Action ${actionId} not found`);
      }
    }

    const baseUsersByAction = await recipientService.findBaseUsersForEvents({
      entries: actions.map((action) => ({
        action,
        eventId: getMemberActionEvent(action).id,
      })),
      includeDismissed: true,
    });

    const actionRosters = new Map<number, ActionRoster>();
    for (const action of actions) {
      const userIds = new Set(
        (baseUsersByAction.get(action.id) ?? [])
          .filter((user) => !user.staff)
          .map((user) => user.id),
      );
      actionRosters.set(action.id, {
        actionId: action.id,
        actionName: action.name,
        userIds,
      });
    }

    const activities = await activityRepo.find({
      where: ACTION_IDS.flatMap((actionId) => [
        { actionId, type: ActionActivityType.USER_COMPLETED },
        { actionId, type: ActionActivityType.USER_WONT_COMPLETE },
      ]),
      order: { createdAt: "ASC" },
    });
    const latestTerminalByUserAction = new Map<string, LatestTerminal>();
    for (const activity of activities) {
      latestTerminalByUserAction.set(
        `${activity.userId}:${activity.actionId}`,
        {
          type: activity.type as LatestTerminal["type"],
          createdAt: activity.createdAt,
        },
      );
    }

    const action133 = actionById.get(ACTION_133_ID)!;
    const action133WindowStart = action133.memberActionPhase.event?.date;
    const action133WindowEnd = action133.memberActionPhase.deadlineEvent?.date;
    if (!action133WindowStart || !action133WindowEnd) {
      throw new Error(
        `Action ${ACTION_133_ID} does not have a complete member-action window`,
      );
    }
    const action74 = actionById.get(ACTION_74_ID)!;
    const action74WindowStart = action74.memberActionPhase.event?.date;
    const action74WindowEnd = action74.memberActionPhase.deadlineEvent?.date;
    if (!action74WindowStart || !action74WindowEnd) {
      throw new Error(
        `Action ${ACTION_74_ID} does not have a complete member-action window`,
      );
    }
    const variants = await variantRepo.find({
      where: { actionId: ACTION_133_ID },
    });
    const variantFormIdById = new Map(
      variants.map((variant) => [variant.id, variant.formId]),
    );
    const assignments = await assignmentRepo.find({
      where: { actionId: ACTION_133_ID },
    });
    const assignedFormIdByUser = new Map<number, number>();
    for (const assignment of assignments) {
      const formId =
        assignment.variantId === null
          ? action133.taskFormId
          : variantFormIdById.get(assignment.variantId);
      if (formId !== undefined) {
        assignedFormIdByUser.set(assignment.userId, formId);
      }
    }

    const action133CompletionFormRows = await activityRepo
      .createQueryBuilder("activity")
      .leftJoin("activity.taskFormResponse", "response")
      .select('activity."userId"', "userId")
      .addSelect('response."formId"', "formId")
      .where('activity."actionId" = :actionId', { actionId: ACTION_133_ID })
      .andWhere("activity.type = :type", {
        type: ActionActivityType.USER_COMPLETED,
      })
      .andWhere('response."formId" IN (:...formIds)', {
        formIds: ACTION_133_FORM_IDS,
      })
      .getRawMany<{ userId: number; formId: number }>();
    for (const row of action133CompletionFormRows) {
      if (!assignedFormIdByUser.has(Number(row.userId))) {
        assignedFormIdByUser.set(Number(row.userId), Number(row.formId));
      }
    }

    const formResponseRows = await formResponseRepo
      .createQueryBuilder("response")
      .select('response."userId"', "userId")
      .addSelect('response."formId"', "formId")
      .addSelect("response.answers", "answers")
      .addSelect('response."createdAt"', "createdAt")
      .where('response."formId" IN (:...formIds)', {
        formIds: ACTION_133_FORM_IDS,
      })
      .andWhere('response."userId" IS NOT NULL')
      .orderBy('response."createdAt"', "ASC")
      .getRawMany<{
        userId: number;
        formId: number;
        answers: Record<string, unknown>;
        createdAt: Date;
      }>();
    const selfReportedInvitesByUser = new Map<number, number>();
    for (const row of formResponseRows) {
      const userId = Number(row.userId);
      const formId = Number(row.formId);
      if (!assignedFormIdByUser.has(userId)) {
        assignedFormIdByUser.set(userId, formId);
      }
      selfReportedInvitesByUser.set(
        userId,
        numberAnswer(row.answers, INVITES_SENT_ANSWER_FIELD_ID),
      );
    }

    const inviteComparisonRows = await formResponseRepo
      .createQueryBuilder("response")
      .select('response."userId"', "userId")
      .addSelect('response."formId"', "formId")
      .addSelect("response.answers", "answers")
      .addSelect('response."createdAt"', "createdAt")
      .where('response."formId" IN (:...formIds)', {
        formIds: [67, ...ACTION_133_FORM_IDS],
      })
      .andWhere('response."userId" IS NOT NULL')
      .orderBy('response."createdAt"', "ASC")
      .getRawMany<{
        userId: number;
        formId: number;
        answers: Record<string, unknown>;
        createdAt: Date;
      }>();
    const action74InvitesByUser = new Map<number, number>();
    const action133InvitesByForm = new Map<number, Map<number, number>>(
      ACTION_133_FORM_IDS.map((formId) => [formId, new Map<number, number>()]),
    );
    const action133IndividualInvitesByForm = new Map<
      number,
      Map<number, number>
    >(ACTION_133_FORM_IDS.map((formId) => [formId, new Map<number, number>()]));
    for (const row of inviteComparisonRows) {
      const userId = Number(row.userId);
      const formId = Number(row.formId);
      if (formId === 67) {
        const invites = optionalNumberAnswer(
          row.answers,
          ACTION_74_INVITES_SENT_ANSWER_FIELD_ID,
        );
        if (invites !== null) {
          action74InvitesByUser.set(userId, invites);
        }
        continue;
      }
      if (
        ACTION_133_FORM_IDS.includes(
          formId as (typeof ACTION_133_FORM_IDS)[number],
        )
      ) {
        const invites = optionalNumberAnswer(
          row.answers,
          INVITES_SENT_ANSWER_FIELD_ID,
        );
        if (invites !== null) {
          action133InvitesByForm.get(formId)!.set(userId, invites);
          action133IndividualInvitesByForm.get(formId)!.set(userId, invites);
        }
      }
    }

    const action133Roster = actionRosters.get(ACTION_133_ID)!;
    const formRosters: FormRoster[] = ACTION_133_FORM_IDS.map((formId) => {
      const formUserIds = new Set(
        [...action133Roster.userIds].filter(
          (userId) => assignedFormIdByUser.get(userId) === formId,
        ),
      );
      return {
        actionId: ACTION_133_ID,
        actionName: action133.name,
        formId,
        label: `action ${ACTION_133_ID} form ${formId}`,
        userIds: formUserIds,
      };
    });

    const unassignedAction133UserIds = [...action133Roster.userIds]
      .filter((userId) => !assignedFormIdByUser.has(userId))
      .sort((a, b) => a - b);

    const action133UserIds = [...action133Roster.userIds].sort((a, b) => a - b);
    const action133Users = await userRepo.find({
      where: action133UserIds.map((id) => ({ id })),
    });
    const userNameById = new Map(
      action133Users.map((user) => [user.id, user.name]),
    );
    const action133Invites =
      action133UserIds.length === 0
        ? []
        : await inviteRepo
            .createQueryBuilder("invite")
            .select([
              "invite.id",
              "invite.createdAt",
              "invite.status",
              "invite.invitingUser",
            ])
            .leftJoinAndSelect("invite.invitingUser", "invitingUser")
            .leftJoinAndSelect("invite.invitedUser", "invitedUser")
            .leftJoinAndSelect("invitedUser.contractEvents", "contractEvent")
            .where('invite."invitingUserId" IN (:...userIds)', {
              userIds: action133UserIds,
            })
            .andWhere('invite."createdAt" >= :windowStart', {
              windowStart: action133WindowStart,
            })
            .andWhere('invite."createdAt" <= :windowEnd', {
              windowEnd: ACTION_133_INVITE_SUCCESS_END,
            })
            .andWhere('invite."deletedAt" IS NULL')
            .orderBy('invite."createdAt"', "ASC")
            .getMany();
    const action133SuccessInvites =
      action133UserIds.length === 0
        ? []
        : await inviteRepo
            .createQueryBuilder("invite")
            .select([
              "invite.id",
              "invite.createdAt",
              "invite.status",
              "invite.deletedAt",
              "invite.usedAt",
              "invite.invitingUser",
            ])
            .leftJoinAndSelect("invite.invitingUser", "invitingUser")
            .leftJoinAndSelect("invite.invitedUser", "invitedUser")
            .leftJoinAndSelect("invitedUser.contractEvents", "contractEvent")
            .where('invite."invitingUserId" IN (:...userIds)', {
              userIds: action133UserIds,
            })
            .andWhere('invite."createdAt" >= :windowStart', {
              windowStart: action133WindowStart,
            })
            .andWhere('invite."createdAt" <= :windowEnd', {
              windowEnd: ACTION_133_INVITE_SUCCESS_END,
            })
            .andWhere('invite."deletedAt" IS NULL')
            .orderBy('invite."createdAt"', "ASC")
            .getMany();
    const action74UserIds = [...actionRosters.get(ACTION_74_ID)!.userIds].sort(
      (a, b) => a - b,
    );
    const action74ActualInvites =
      action74UserIds.length === 0
        ? []
        : await inviteRepo
            .createQueryBuilder("invite")
            .select([
              "invite.id",
              "invite.createdAt",
              "invite.status",
              "invite.deletedAt",
              "invite.usedAt",
              "invite.invitingUser",
            ])
            .leftJoinAndSelect("invite.invitingUser", "invitingUser")
            .where('invite."invitingUserId" IN (:...userIds)', {
              userIds: action74UserIds,
            })
            .andWhere('invite."createdAt" >= :windowStart', {
              windowStart: action74WindowStart,
            })
            .andWhere('invite."createdAt" <= :windowEnd', {
              windowEnd: action74WindowEnd,
            })
            .andWhere('invite."deletedAt" IS NULL')
            .orderBy('invite."createdAt"', "ASC")
            .getMany();

    const inviteStatsByUser = new Map<number, InviterInviteStats>();
    for (const [userId, rawInvitesSent] of selfReportedInvitesByUser) {
      const formId = assignedFormIdByUser.get(userId);
      if (
        !formId ||
        rawInvitesSent <= 0 ||
        !action133Roster.userIds.has(userId)
      ) {
        continue;
      }
      inviteStatsByUser.set(userId, {
        formId,
        userId,
        userName: userNameById.get(userId) ?? `(user ${userId})`,
        rawInvitesSent,
        inviteLinkRows: 0,
        acceptedInvites: 0,
        signedContractInvites: 0,
        statusCounts: emptyInviteStatusCounts(),
        inviteIds: [],
      });
    }
    for (const invite of action133Invites) {
      const userId = invite.invitingUser.id;
      const formId = assignedFormIdByUser.get(userId);
      if (!formId) {
        continue;
      }
      const userName = userNameById.get(userId) ?? invite.invitingUser.name;
      const existing = inviteStatsByUser.get(userId);
      const stats =
        existing ??
        ({
          formId,
          userId,
          userName,
          rawInvitesSent: selfReportedInvitesByUser.get(userId) ?? 0,
          inviteLinkRows: 0,
          acceptedInvites: 0,
          signedContractInvites: 0,
          statusCounts: emptyInviteStatusCounts(),
          inviteIds: [],
        } satisfies InviterInviteStats);
      stats.inviteLinkRows += 1;
      stats.statusCounts[invite.status] += 1;
      stats.inviteIds.push(invite.id);
      if (invite.status === OnetimeInviteStatus.LINK_USED) {
        stats.acceptedInvites += 1;
      }
      if (inviteSignedContractBy(invite, ACTION_133_INVITE_SUCCESS_END)) {
        stats.signedContractInvites += 1;
      }
      inviteStatsByUser.set(userId, stats);
    }

    const inviterStats = [...inviteStatsByUser.values()].sort((a, b) => {
      if (a.formId !== b.formId) {
        return a.formId - b.formId;
      }
      return (
        b.rawInvitesSent - a.rawInvitesSent ||
        a.userName.localeCompare(b.userName)
      );
    });
    for (const stats of inviterStats) {
      stats.override = getManualOverride({
        formId: stats.formId,
        userId: stats.userId,
        userName: stats.userName,
      });
      if (stats.override) {
        action133IndividualInvitesByForm
          .get(stats.formId)!
          .set(stats.userId, stats.override.individualInvites);
      }
    }

    const assignedNonStaffNonManualUserIds = action133UserIds.filter(
      (userId) => {
        const userName = userNameById.get(userId) ?? `(user ${userId})`;
        const user = action133Users.find(
          (candidate) => candidate.id === userId,
        );
        const formId = assignedFormIdByUser.get(userId);
        if (!user || user.staff || !formId) {
          return false;
        }
        return (
          getManualOverride({
            formId,
            userId,
            userName,
          }) === undefined
        );
      },
    );

    console.log("Action rosters");
    for (const actionId of ACTION_IDS) {
      const roster = actionRosters.get(actionId)!;
      console.log(
        `action ${actionId} (${roster.actionName}): ${roster.userIds.size} eligible members`,
      );
    }
    for (const roster of formRosters) {
      console.log(
        `${roster.label}: ${roster.userIds.size} eligible assigned members`,
      );
    }
    printIds(
      "action 133 eligible members with no form assignment/response",
      unassignedAction133UserIds,
    );
    printInviteFramingStats({
      actionWindowStart: action133WindowStart,
      actionWindowEnd: ACTION_133_INVITE_SUCCESS_END,
      inviterStats,
    });
    console.log(
      "\n=== Action 133 invite success, non-staff assigned members ===",
    );
    console.log(
      `invite window: ${action133WindowStart.toISOString()} to ${ACTION_133_INVITE_SUCCESS_END.toISOString()}`,
    );
    console.log(
      "excluded: staff inviters, unassigned inviters, and manual massive group-invite overrides",
    );
    printInviteSuccessStats(
      inviteSuccessStats({
        label:
          "all action 133 assigned non-staff members, excluding massive group-invite overrides",
        inviterIds: assignedNonStaffNonManualUserIds,
        invites: action133SuccessInvites,
        conversionEnd: ACTION_133_INVITE_SUCCESS_END,
      }),
    );
    for (const formRoster of formRosters) {
      printInviteSuccessStats(
        inviteSuccessStats({
          label: `${formRoster.label}: assigned non-staff members, excluding massive group-invite overrides`,
          inviterIds: assignedNonStaffNonManualUserIds.filter((userId) =>
            formRoster.userIds.has(userId),
          ),
          invites: action133SuccessInvites,
          conversionEnd: ACTION_133_INVITE_SUCCESS_END,
        }),
      );
    }

    const action133IndividualInvitesByUser = new Map<number, number>();
    for (const formMap of action133IndividualInvitesByForm.values()) {
      for (const [userId, invites] of formMap) {
        action133IndividualInvitesByUser.set(userId, invites);
      }
    }
    console.log("\n=== Self-reported invites vs actual invite rows ===");
    console.log(
      `action 133 actual invite window: ${action133WindowStart.toISOString()} to ${ACTION_133_INVITE_SUCCESS_END.toISOString()}`,
    );
    console.log(
      `action 74 actual invite window: ${action74WindowStart.toISOString()} to ${action74WindowEnd.toISOString()}`,
    );
    console.log(
      "action 133 self-reports use counted individual invites after massive group-invite overrides; staff are excluded throughout",
    );
    printSelfReportedVsActualInvitesStats(
      selfReportedVsActualInvitesStats({
        label: "action 133 combined",
        assignedUserIds: assignedNonStaffNonManualUserIds,
        selfReportedInvitesByUser: action133IndividualInvitesByUser,
        actualInvites: action133SuccessInvites,
      }),
    );
    for (const formRoster of formRosters) {
      printSelfReportedVsActualInvitesStats(
        selfReportedVsActualInvitesStats({
          label: formRoster.label,
          assignedUserIds: assignedNonStaffNonManualUserIds.filter((userId) =>
            formRoster.userIds.has(userId),
          ),
          selfReportedInvitesByUser: action133IndividualInvitesByForm.get(
            formRoster.formId,
          )!,
          actualInvites: action133SuccessInvites,
        }),
      );
    }
    printSelfReportedVsActualInvitesStats(
      selfReportedVsActualInvitesStats({
        label: `action ${ACTION_74_ID}`,
        assignedUserIds: action74UserIds,
        selfReportedInvitesByUser: action74InvitesByUser,
        actualInvites: action74ActualInvites,
      }),
    );

    const roster132 = actionRosters.get(ACTION_132_ID)!;
    const roster74 = actionRosters.get(ACTION_74_ID)!;

    const action133AssignedBoth74UserIds = [...action133Roster.userIds]
      .filter((userId) => roster74.userIds.has(userId))
      .sort((a, b) => a - b);
    const action133OnlyUserIds = [...action133Roster.userIds]
      .filter((userId) => !roster74.userIds.has(userId))
      .sort((a, b) => a - b);
    console.log(
      "\n=== Action 74 to action 133 growth-action repeat vs 133-only split ===",
    );
    printGrowthActionSegmentStats(
      growthActionSegmentStats({
        label: "assigned both action 74 and action 133",
        userIds: action133AssignedBoth74UserIds,
        selfReportedInvitesByUser: action133IndividualInvitesByUser,
        actualInvites: action133SuccessInvites,
      }),
    );
    printGrowthActionSegmentStats(
      growthActionSegmentStats({
        label: "assigned action 133 but not action 74",
        userIds: action133OnlyUserIds,
        selfReportedInvitesByUser: action133IndividualInvitesByUser,
        actualInvites: action133SuccessInvites,
      }),
    );

    console.log("\n=== Action 132 to action 133 dropoff analysis ===");
    const action132OnlyUserIds = [...roster132.userIds]
      .filter((userId) => !action133Roster.userIds.has(userId))
      .sort((a, b) => a - b);
    const action132OnlyCompletedUserIds = action132OnlyUserIds.filter(
      (userId) =>
        completionState({
          latestTerminalByUserAction,
          userId,
          actionId: ACTION_132_ID,
        }) === "completed",
    );
    const action132OnlyIncompleteUserIds = action132OnlyUserIds.filter(
      (userId) =>
        completionState({
          latestTerminalByUserAction,
          userId,
          actionId: ACTION_132_ID,
        }) === "incomplete",
    );
    printIds(
      "action 132 eligible but not action 133 assigned",
      action132OnlyUserIds,
    );
    printIds(
      "action 132 eligible but not action 133 assigned, completed action 132",
      action132OnlyCompletedUserIds,
    );
    printIds(
      "action 132 eligible but not action 133 assigned, did not complete action 132",
      action132OnlyIncompleteUserIds,
    );
    printAction132To133DropoffStats({
      label: "action 132 vs action 133 combined",
      pair: pairStats({
        labelA: `action ${ACTION_132_ID}`,
        labelB: `action ${ACTION_133_ID}`,
        rosterA: roster132.userIds,
        rosterB: action133Roster.userIds,
        actionAId: ACTION_132_ID,
        actionBId: ACTION_133_ID,
        latestTerminalByUserAction,
      }),
    });
    for (const formRoster of formRosters) {
      printAction132To133DropoffStats({
        label: `action 132 vs ${formRoster.label}`,
        pair: pairStats({
          labelA: `action ${ACTION_132_ID}`,
          labelB: formRoster.label,
          rosterA: roster132.userIds,
          rosterB: formRoster.userIds,
          actionAId: ACTION_132_ID,
          actionBId: ACTION_133_ID,
          latestTerminalByUserAction,
        }),
      });
    }

    console.log("\n=== Action 132 vs action 133 forms ===");
    for (const formRoster of formRosters) {
      printPairStats(
        pairStats({
          labelA: `action ${ACTION_132_ID}`,
          labelB: formRoster.label,
          rosterA: roster132.userIds,
          rosterB: formRoster.userIds,
          actionAId: ACTION_132_ID,
          actionBId: ACTION_133_ID,
          latestTerminalByUserAction,
        }),
      );
    }

    console.log("\n=== Action 133 forms vs action 74 ===");
    for (const formRoster of formRosters) {
      printPairStats(
        pairStats({
          labelA: formRoster.label,
          labelB: `action ${ACTION_74_ID}`,
          rosterA: formRoster.userIds,
          rosterB: roster74.userIds,
          actionAId: ACTION_133_ID,
          actionBId: ACTION_74_ID,
          latestTerminalByUserAction,
        }),
      );
    }

    console.log("\n=== Invite-count changes from action 74 to action 133 ===");
    for (const formRoster of formRosters) {
      const formVsAction74 = pairStats({
        labelA: formRoster.label,
        labelB: `action ${ACTION_74_ID}`,
        rosterA: formRoster.userIds,
        rosterB: roster74.userIds,
        actionAId: ACTION_133_ID,
        actionBId: ACTION_74_ID,
        latestTerminalByUserAction,
      });
      const action133InvitesByUser = action133IndividualInvitesByForm.get(
        formRoster.formId,
      )!;
      printInviteComparisonStats(
        inviteComparisonStats({
          label: `${formRoster.label}: all overlapping eligible members with numeric individual invite counts in both actions`,
          candidateUserIds: formVsAction74.overlapUserIds,
          action74InvitesByUser,
          action133InvitesByUser,
        }),
      );
      printInviteComparisonStats(
        inviteComparisonStats({
          label: `${formRoster.label}: completed both action 74 and action 133, with numeric individual invite counts in both actions`,
          candidateUserIds: formVsAction74.completedBoth,
          action74InvitesByUser,
          action133InvitesByUser,
        }),
      );
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
