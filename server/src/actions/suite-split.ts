import { hasTakenEffect } from "@alliance/common/actionEvent";
import type { CohortExpression } from "@alliance/common/cohort-expression";
import { isEqual } from "es-toolkit";
import type { ObjectLiteral, SelectQueryBuilder } from "typeorm";
import {
  SplitVisibilityMode,
  type ActionSuiteSplit,
} from "./entities/action-suite-split.entity";
import { loadedSplitArms, type Action } from "./entities/action.entity";

/**
 * The expression selecting the members routed to each arm: those the filter
 * reaches who match the arm's rule and no earlier arm's. The arms' sets are
 * disjoint and together make up the filter's.
 */
export function armRoutingExpressions(split: {
  filterExpression: CohortExpression | null;
  arms: { actionId: number; rule: CohortExpression | null }[];
}): Map<number, CohortExpression> {
  const routing = new Map<number, CohortExpression>();
  split.arms.forEach((arm, index) => {
    const children: CohortExpression[] = [
      ...(split.filterExpression ? [split.filterExpression] : []),
      ...split.arms
        .slice(0, index)
        .flatMap((earlier) =>
          earlier.rule ? [{ type: "NOT" as const, child: earlier.rule }] : [],
        ),
      ...(arm.rule ? [arm.rule] : []),
    ];
    routing.set(
      arm.actionId,
      children.length === 0
        ? { type: "AllMembers" }
        : children.length === 1
          ? children[0]
          : { type: "AND", children },
    );
  });
  return routing;
}

export function splitPrerequisiteActionIds(
  arms: Pick<Action, "prerequisiteActionIds">[],
): number[] {
  return [...new Set(arms.flatMap((arm) => arm.prerequisiteActionIds))].sort(
    (a, b) => a - b,
  );
}

/**
 * Whether the action is optional for its members. An arm's own `optional`
 * stays false; its arm row carries the flag.
 */
export function isActionOptional(
  action: Pick<Action, "id" | "optional" | "splitArms">,
): boolean {
  return loadedSplitArms(action)[0]?.optional ?? action.optional;
}

export type CombinedCounts = { usersJoined: number; usersCompleted: number };

/**
 * The split other members see in place of this arm, or null when they see the
 * action itself.
 */
export function combinedSplitOf(
  action: Pick<Action, "id" | "splitArms">,
): ActionSuiteSplit | null {
  const [arm] = loadedSplitArms(action);
  if (!arm) return null;
  if (!arm.split) throw new Error(`split of arm ${arm.id} not loaded`);
  return arm.split.visibilityMode === SplitVisibilityMode.Combined
    ? arm.split
    : null;
}

export function armIneligibility(
  action: Pick<
    Action,
    | "name"
    | "onboarding"
    | "publicOnly"
    | "isContractSigningAction"
    | "staffPreview"
  >,
): string | null {
  const kinds = [
    action.onboarding && "an onboarding action",
    action.publicOnly && "a public-only action",
    action.isContractSigningAction && "a contract-signing action",
    action.staffPreview && "a staff-preview action",
  ].filter((kind) => typeof kind === "string");
  return kinds.length === 0
    ? null
    : `"${action.name}" is ${kinds.join(" and ")}, so it can't be an arm.`;
}

/**
 * Why the arms' schedules disagree, or null when they share one member-action
 * date and one deadline.
 */
export function armScheduleMismatch(
  actions: Pick<Action, "name" | "memberActionPhase">[],
): string | null {
  const time = (date: Date | undefined) => date?.getTime() ?? null;
  const [first, ...rest] = actions;
  if (!first) return null;
  const start = time(first.memberActionPhase.event?.date);
  const deadline = time(first.memberActionPhase.deadlineEvent?.date);
  const off = rest.find(
    (action) =>
      time(action.memberActionPhase.event?.date) !== start ||
      time(action.memberActionPhase.deadlineEvent?.date) !== deadline,
  );
  return off
    ? `"${off.name}" doesn't share "${first.name}"'s launch date and deadline. A split's arms must share both.`
    : null;
}

/** Whether the split's arms have launched, which freezes its routing. */
export function hasSplitLaunched(
  arms: Pick<Action, "memberActionPhase">[],
  now: Date,
): boolean {
  return arms.some((arm) => {
    const event = arm.memberActionPhase.event;
    return !!event && hasTakenEffect(event.date, now);
  });
}

type ArmEditable = {
  cohortExpression?: unknown;
  optional?: boolean;
  suiteId?: number | null;
  onboarding?: boolean;
  publicOnly?: boolean;
  isContractSigningAction?: boolean;
  staffPreview?: boolean;
};

export function armEditRejection(params: {
  stored: ArmEditable;
  next: ArmEditable;
}): string | null {
  const { stored, next } = params;
  if (
    next.cohortExpression !== undefined &&
    !isEqual(next.cohortExpression, stored.cohortExpression)
  ) {
    return "This action is an arm of a split, which sets its cohort. Edit the split's rules instead.";
  }
  if (next.optional === true) {
    return "This action is an arm of a split. Set whether it's optional on the split's arm.";
  }
  if (next.suiteId != null && next.suiteId !== stored.suiteId) {
    return "This action is an arm of a split. Take it out of the split before moving it to another suite.";
  }
  const kinds = (
    [
      "onboarding",
      "publicOnly",
      "isContractSigningAction",
      "staffPreview",
    ] as const
  ).filter((kind) => next[kind] === true && stored[kind] !== true);
  return kinds.length > 0
    ? "This action is an arm of a split, so it must stay a regular action."
    : null;
}

/**
 * Joins and selects what {@link combinedSplitOf} reads, for query-builder
 * loads, which skip eager relations. Call it after any `select`, which would
 * drop these columns.
 */
export function selectSplitDisplay<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  actionAlias: string,
): SelectQueryBuilder<T> {
  const arm = `${actionAlias}SplitArm`;
  const split = `${actionAlias}Split`;
  return qb
    .leftJoin(`${actionAlias}.splitArms`, arm, `"${arm}"."deletedAt" IS NULL`)
    .leftJoin(`${arm}.split`, split)
    .addSelect([
      `${arm}.id`,
      `${arm}.optional`,
      `${split}.id`,
      `${split}.title`,
      `${split}.visibilityMode`,
    ]);
}
