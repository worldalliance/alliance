import {
  formSchema,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import type { ActionSuiteDto, UserDto } from "@alliance/shared/client";
import { actionAdminQuery } from "@alliance/shared/lib/useActionAdmin";
import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { adminTaskFormQuery } from "@alliance/shared/lib/useTaskForm";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import {
  hashKey,
  useQueries,
  useQuery,
  type QueryKey,
} from "@tanstack/react-query";
import { addYears, max } from "date-fns";
import { omit } from "es-toolkit";
import { useState } from "react";
import { useAwayRangesInWindowAdmin } from "../../lib/useAwayRangesInWindowAdmin";
import { cohortEvaluationQuery } from "../../lib/useCohortEvaluationAdmin";
import { useUsersAdmin } from "../../lib/useUsersAdmin";
import {
  actionReadinessItems,
  readingTime,
  type ReadinessCheckItem,
} from "../../pages/action-dashboard/actionReadiness";
import { actionTextFindings, type TextFinding } from "./actionTextFindings";
import type { LaunchSchedule } from "./launchSchedule";
import { memberLoads, type MemberLoad } from "./memberLoad";
import { spellcheckerQuery } from "./spellchecker";

export type LaunchAction = {
  action: ParsedActionDto;
  unready: ReadinessCheckItem[];
  memberCount: number | null;
  /** Changes whenever the action or its task form is saved. */
  reviewVersion: string;
  /** The longest read any member gets, across the task form and its variants. */
  readingSeconds: number;
  /** When the action's own members taking action event starts, if it has one. */
  ownMemberStart: string | null;
};

export type SuiteLaunchData = {
  actions: LaunchAction[];
  /** Null while any action's member count is unknown. */
  loads: MemberLoad[] | null;
  /** Null while any action's member count is unknown. */
  recipientCount: number | null;
  users: UserDto[];
  usersLoadFailed: boolean;
  /** Each recipient's saved zone, null when they've saved none. */
  recipientTimeZones: (string | null)[];
  textFindings: TextFinding[];
  errors: string[];
  loading: boolean;
  spellcheckLoading: boolean;
  refetch: () => void;
};

// Leaves out what changes without a staff edit (counts, timestamps, events,
// status), what depends on who is viewing, relations the readiness checklist
// re-checks on every load or no launch check reads, and `storedImage` and
// `storedSquareThumbnailImage`, which `image` and `squareThumbnailImage`
// repeat, so any other field, including one added later, clears a ready mark.
const reviewedFields = (action: ParsedActionDto) => ({
  ...omit(action, [
    "createdAt",
    "updatedAt",
    "usersJoined",
    "usersCompleted",
    "computedAutocompleteAt",
    "customStatValue",
    "priority",
    "events",
    "status",
    "updates",
    "memberActionStart",
    "memberActionDeadline",
    "canParticipate",
    "shouldParticipate",
    "userRelation",
    "awayStatus",
    "viewer",
    "reqAuthenticated",
    "suite",
    "project",
    "authors",
    "reviewers",
    "followUpForms",
    "storedImage",
    "storedSquareThumbnailImage",
  ]),
  followUpForms: action.followUpForms.map((form) => omit(form, ["form"])),
});

/** Each distinct query once, and each entry's slot among them. */
function distinctQueries<T extends { queryKey: QueryKey }>(queries: T[]) {
  const hashes = queries.map((query) => hashKey(query.queryKey));
  const distinctHashes = [...new Set(hashes)];
  return {
    queries: distinctHashes.map((hash) => queries[hashes.indexOf(hash)]),
    slots: hashes.map((hash) => distinctHashes.indexOf(hash)),
  };
}

export function useSuiteLaunchData(params: {
  suite: ActionSuiteDto;
  schedule: LaunchSchedule;
}): SuiteLaunchData {
  const { suite, schedule } = params;
  const actionResults = useQueries({
    queries: suite.actions.map((action) => actionAdminQuery(action.id)),
  });
  const parsed = actionResults.map((result) => result.data);
  const formQueries = parsed.map((entry) =>
    adminTaskFormQuery(entry?.action.taskFormId ?? undefined),
  );
  const forms = distinctQueries(formQueries);
  const formResults = useQueries({ queries: forms.queries });
  const formResultOf = (index: number) => formResults[forms.slots[index]];
  const cohortQueries = parsed.map((entry) =>
    cohortEvaluationQuery(entry?.action.cohortExpression),
  );
  const cohorts = distinctQueries(cohortQueries);
  const cohortResults = useQueries({ queries: cohorts.queries });
  const cohortResultOf = (index: number) => cohortResults[cohorts.slots[index]];
  const actionList = useActionsAdmin();
  const variantFormIdsByAction = new Map(
    (actionList.data ?? []).map((item) => [item.id, item.variantFormIds]),
  );
  const variantFormIds = suite.actions.flatMap(
    (action) => variantFormIdsByAction.get(action.id) ?? [],
  );
  const variantResults = useQueries({
    queries: variantFormIds.map((formId) => adminTaskFormQuery(formId)),
  });
  const variantFormById = new Map(
    variantFormIds.map((formId, index) => [formId, variantResults[index].data]),
  );
  const spellchecker = useQuery(spellcheckerQuery);
  const users = useUsersAdmin();
  const timeZoneByUserId = new Map(
    (users.data ?? []).map((user) => [user.id, user.timeZone]),
  );
  const idsWhere = (keep: (user: UserDto) => boolean) =>
    new Set((users.data ?? []).filter(keep).map((user) => user.id));
  const contracted = idsWhere((user) => user.hasActiveContract);
  const neverSigned = idsWhere((user) => !user.lastContractEvent);
  const [awayFrom] = useState(() => new Date());
  // A year-long window keeps schedule edits from refetching. An office date
  // past that year widens the window, and the old window's ranges keep the
  // checks mounted while the counts read unknown.
  const awayRanges = useAwayRangesInWindowAdmin(
    {
      from: awayFrom,
      to: max([addYears(awayFrom, 1), schedule.officeActionAt]),
    },
    { keepPrevious: true },
  );
  const awayData = awayRanges.isPlaceholderData ? undefined : awayRanges.data;
  const away = new Set(
    (awayData ?? [])
      .filter(
        (range) =>
          new Date(range.startDate) < schedule.officeActionAt &&
          new Date(range.endDate) > schedule.memberActionAt,
      )
      .map((range) => range.userId),
  );

  const errors: string[] = [];
  const actions: LaunchAction[] = [];
  const textFindings: TextFinding[] = [];
  const cohortByActionId = new Map<number, number[]>();
  parsed.forEach((entry, index) => {
    if (!entry) return;
    const { action, cohortExpressionError } = entry;
    if (cohortExpressionError) {
      errors.push(`${action.name}: invalid cohort expression.`);
    }
    let schema: FormSchema | null = null;
    const form = formResultOf(index).data;
    if (form) {
      const parsedSchema = formSchema.safeParse(form.schema);
      if (parsedSchema.success) schema = parsedSchema.data;
      else errors.push(`${action.name}: its task form's schema is invalid.`);
    }
    const variantForms = (variantFormIdsByAction.get(action.id) ?? []).flatMap(
      (formId) => {
        const variant = variantFormById.get(formId);
        if (!variant) return [];
        const parsedSchema = formSchema.safeParse(variant.schema);
        if (!parsedSchema.success) {
          errors.push(`${action.name}: a variant form's schema is invalid.`);
          return [];
        }
        return [
          {
            formId,
            schema: parsedSchema.data,
            snapshotId: variant.formSnapshotId,
          },
        ];
      },
    );
    const evaluated = action.cohortExpression
      ? cohortResultOf(index).data?.userIds
      : [];
    // Mirrors computeIsAssignedAndPresent in server/src/utils/action-user.ts.
    // Never signing stands in for first signing at or after a launch still to
    // come, and hasActiveContract (active now) for a contract held throughout
    // the members-to-office window, since contract events are never dated in
    // the future.
    const admitted = action.onboarding ? neverSigned : contracted;
    const cohort =
      users.data && awayData
        ? evaluated?.filter(
            (userId) => admitted.has(userId) && !away.has(userId),
          )
        : undefined;
    if (cohort) cohortByActionId.set(action.id, cohort);
    actions.push({
      action,
      unready: actionReadinessItems(action, schema).filter(
        (item) => !item.isReady,
      ),
      memberCount: cohort ? cohort.length : null,
      reviewVersion: JSON.stringify([
        reviewedFields(action),
        form?.formSnapshotId ?? null,
        variantForms.map(({ formId, snapshotId }) => [formId, snapshotId]),
      ]),
      readingSeconds: Math.max(
        ...[schema, ...variantForms.map((variant) => variant.schema)].map(
          (read) => readingTime(action, read).totalSeconds,
        ),
      ),
      ownMemberStart: action.memberActionStart,
    });
    textFindings.push(
      ...actionTextFindings({
        action,
        taskFormSchema: schema,
        taskFormId: action.taskFormId,
        variantForms,
        isKnownWord: spellchecker.data,
      }),
    );
  });
  const loads =
    actions.length === suite.actions.length &&
    actions.every(({ memberCount }) => memberCount !== null)
      ? memberLoads({
          actions: actions.map(({ action }) => action),
          cohortByActionId,
        })
      : null;

  const loadErrors = [
    ...actionResults.flatMap((result, index) =>
      result.isError
        ? [`Failed to load action ${suite.actions[index].name}.`]
        : [],
    ),
    ...suite.actions.flatMap((action, index) =>
      formResultOf(index).isError
        ? [`Failed to load the task form for ${action.name}.`]
        : [],
    ),
    ...suite.actions.flatMap((action, index) =>
      cohortResultOf(index).isError
        ? [`Failed to evaluate the cohort for ${action.name}.`]
        : [],
    ),
    ...(actionList.isError
      ? ["Failed to load the actions' variant forms."]
      : []),
    ...variantResults.flatMap((result) =>
      result.isError ? ["Failed to load a variant form."] : [],
    ),
    ...(users.isError ? ["Failed to load members' contract status."] : []),
    ...(awayRanges.isError ? ["Failed to load members' away dates."] : []),
    ...(spellchecker.isError
      ? ["Failed to load the spelling dictionary."]
      : []),
  ];

  return {
    actions,
    loads,
    recipientCount: loads ? loads.length : null,
    users: users.data ?? [],
    usersLoadFailed: users.isError,
    recipientTimeZones: (loads ?? []).map(
      ({ userId }) => timeZoneByUserId.get(userId) ?? null,
    ),
    textFindings,
    errors: [...loadErrors, ...errors],
    // A disabled query stays idle and never loads; one paused offline still will.
    loading: [
      ...actionResults,
      ...formResults,
      ...cohortResults,
      actionList,
      ...variantResults,
      users,
      awayRanges,
    ].some((result) => result.isPending && result.fetchStatus !== "idle"),
    spellcheckLoading: spellchecker.isLoading,
    refetch: () => {
      for (const result of [
        ...actionResults,
        ...formResults,
        ...cohortResults,
        actionList,
        ...variantResults,
        users,
        awayRanges,
      ])
        // A disabled (skipToken) query rejects a refetch with "Missing queryFn".
        if (!(result.isPending && result.fetchStatus === "idle"))
          void result.refetch();
    },
  };
}
