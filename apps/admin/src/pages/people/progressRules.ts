import type {
  CommunityMemberContactInfoDto,
  ContractEventDto,
  UserActionRelationDetailDto,
  UserActionSummaryDto,
} from "@alliance/shared/client/types.gen";
import {
  getDeadlineTimestampByUserId,
  sortMembersByNextTaskDue,
} from "@alliance/shared/lib/communityMemberActions";
import { useOnNextDeadline } from "@alliance/shared/lib/useOnNextDeadline";
import { useCallback, useMemo, useState } from "react";
import { useCompletedAllActiveActions } from "../../lib/useCompletedAllActiveActions";
import { useMaxActionsPerWeek } from "../../ui/UserProgressPills";

export enum ContractFilter {
  All = "all",
  Signed = "signed",
  Suspended = "suspended",
  NotSigned = "not_signed",
}

export const CONTRACT_FILTER_LABELS: Record<ContractFilter, string> = {
  [ContractFilter.All]: "Any contract",
  [ContractFilter.Signed]: "Signed",
  [ContractFilter.Suspended]: "Suspended",
  [ContractFilter.NotSigned]: "Not signed",
};

export enum CompletionFilter {
  Any = "any",
  CaughtUp = "caught_up",
  NotCaughtUp = "not_caught_up",
}

export const COMPLETION_FILTER_LABELS: Record<CompletionFilter, string> = {
  [CompletionFilter.Any]: "Any status",
  [CompletionFilter.CaughtUp]: "Caught up",
  [CompletionFilter.NotCaughtUp]: "Not caught up",
};

type WithContract = { lastContractEvent?: ContractEventDto };

/** A member's contract as its last event leaves it; none is "not signed". */
export const contractOf = ({
  lastContractEvent,
}: WithContract): Exclude<ContractFilter, ContractFilter.All> => {
  if (!lastContractEvent) return ContractFilter.NotSigned;
  const { type } = lastContractEvent;
  switch (type) {
    case "signed":
      return ContractFilter.Signed;
    case "suspended":
      return ContractFilter.Suspended;
    default:
      throw new Error(`unknown contract event: ${type satisfies never}`);
  }
};

const CONTRACT_MATCHES: Record<
  ContractFilter,
  (member: WithContract) => boolean
> = {
  [ContractFilter.All]: () => true,
  [ContractFilter.Signed]: (member) =>
    contractOf(member) === ContractFilter.Signed,
  [ContractFilter.Suspended]: (member) =>
    contractOf(member) === ContractFilter.Suspended,
  [ContractFilter.NotSigned]: (member) =>
    contractOf(member) === ContractFilter.NotSigned,
};

/**
 * The members each contract choice would show, and under the chosen one, the
 * members each completion choice would show: the lists behind the counts in
 * the two filters, and the rows.
 */
export function filterByProgress<T extends WithContract & { id: number }>({
  members,
  contract,
  completion,
  completedAllCurrentActions,
}: {
  members: readonly T[];
  contract: ContractFilter;
  completion: CompletionFilter;
  completedAllCurrentActions: Record<number, boolean>;
}) {
  const byContract: Record<ContractFilter, T[]> = {
    [ContractFilter.All]: [...members],
    [ContractFilter.Signed]: members.filter(
      CONTRACT_MATCHES[ContractFilter.Signed],
    ),
    [ContractFilter.Suspended]: members.filter(
      CONTRACT_MATCHES[ContractFilter.Suspended],
    ),
    [ContractFilter.NotSigned]: members.filter(
      CONTRACT_MATCHES[ContractFilter.NotSigned],
    ),
  };
  const inContract = byContract[contract];
  const byCompletion: Record<CompletionFilter, T[]> = {
    [CompletionFilter.Any]: inContract,
    [CompletionFilter.CaughtUp]: inContract.filter(
      (member) => completedAllCurrentActions[member.id],
    ),
    [CompletionFilter.NotCaughtUp]: inContract.filter(
      (member) => !completedAllCurrentActions[member.id],
    ),
  };
  return { byContract, byCompletion, rows: byCompletion[completion] };
}

const NO_ACTIONS: UserActionSummaryDto[] = [];
const NO_RELATIONS: Record<number, UserActionRelationDetailDto[]> = {};

/**
 * What the progress table reads of the tasks and each member's record on them.
 * The next deadline of each member recomputes when a deadline passes.
 */
export function useMemberProgress({
  actions = NO_ACTIONS,
  userActionRelations,
}: {
  /** Latest last, as the pills run. */
  actions: UserActionSummaryDto[] | undefined;
  /** Null when the records couldn't load or haven't yet. */
  userActionRelations: Record<number, UserActionRelationDetailDto[]> | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useOnNextDeadline(
    actions,
    useCallback(() => setNow(Date.now()), []),
  );
  const relations = userActionRelations ?? NO_RELATIONS;
  const deadlineTimestampByUserId = useMemo(
    () =>
      getDeadlineTimestampByUserId({
        userActionRelations: relations,
        actions,
        now,
      }),
    [relations, actions, now],
  );
  const visibleActions = useMemo(
    () => actions.filter((action) => action.status !== "planned"),
    [actions],
  );
  const maxActionsPerWeek = useMaxActionsPerWeek({
    actionSummaries: actions,
    userActionRelations,
  });
  const completedAllCurrentActions = useCompletedAllActiveActions({
    actionSummaries: actions,
    userActionRelations,
  });
  return {
    /** False while the members' records are missing: their cells read "—". */
    known: userActionRelations !== null,
    actions,
    visibleActions,
    userActionRelations: relations,
    deadlineTimestampByUserId,
    maxActionsPerWeek,
    completedAllCurrentActions,
  };
}

export type MemberProgress = ReturnType<typeof useMemberProgress>;

/** Soonest next task first, then earliest contact time; ties keep the given order. */
export const byNextTaskDue = <T extends { id: number }>({
  members,
  progress,
  memberContactInfo,
}: {
  members: T[];
  progress: MemberProgress;
  memberContactInfo: Record<number, CommunityMemberContactInfoDto> | undefined;
}): T[] =>
  sortMembersByNextTaskDue(
    members,
    progress.deadlineTimestampByUserId,
    memberContactInfo,
  );
