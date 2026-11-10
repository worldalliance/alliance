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
import { formVariantsQuery } from "../../lib/useFormVariantsAdmin";
import { suiteSplitsQuery } from "../../lib/useSuiteSplitsAdmin";
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
import { splitPreview, type SplitPreview } from "./splitPreview";

export type LaunchVariantForm = {
  formId: number;
  name: string;
  /** The share of the action's members assigned this form, from 0 to 1. */
  share: number;
  schema: FormSchema;
  snapshotId: number;
};

export type LaunchAction = {
  action: ParsedActionDto;
  unready: ReadinessCheckItem[];
  memberCount: number | null;
  /** Changes whenever what staff review changes: the action's content or its forms. */
  reviewVersion: string;
  /** The longest read any member gets, across the task form and its variants. */
  readingSeconds: number;
  taskFormSchema: FormSchema | null;
  variantForms: LaunchVariantForm[];
  /** Null until the cohort is evaluated. */
  memberIds: number[] | null;
  /** When the action's own members taking action event starts, if it has one. */
  ownMemberStart: string | null;
};

export type SuiteLaunchData = {
  actions: LaunchAction[];
  /** Null while any action's member count is unknown. */
  loads: MemberLoad[] | null;
  /** Null while any action's member count is unknown. */
  recipientCount: number | null;
  /** Null while the splits or any of their counts are unknown. */
  splits: SplitPreview[] | null;
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
  const listItemById = new Map(
    (actionList.data ?? []).map((item) => [item.id, item]),
  );
  const variantFormIds = [
    ...new Set(
      suite.actions.flatMap(
        (action) => listItemById.get(action.id)?.variantFormIds ?? [],
      ),
    ),
  ];
  const variantResults = useQueries({
    queries: variantFormIds.map((formId) => adminTaskFormQuery(formId)),
  });
  const variantFormById = new Map(
    variantFormIds.map((formId, index) => [formId, variantResults[index].data]),
  );
  const variantListResults = useQueries({
    queries: suite.actions
      .filter((action) => listItemById.get(action.id)?.variantFormIds.length)
      .map((action) => formVariantsQuery(action.id)),
  });
  const variantByFormId = new Map(
    variantListResults.flatMap((result) =>
      (result.data?.variants ?? []).map((variant) => [variant.formId, variant]),
    ),
  );
  const splitsResult = useQuery(suiteSplitsQuery(suite.id));
  const splitFilterResults = useQueries({
    queries: (splitsResult.data ?? []).map((split) =>
      cohortEvaluationQuery(split.filterExpression),
    ),
  });
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
    const listItem = listItemById.get(action.id);
    const variantForms = (listItem?.variantFormIds ?? []).flatMap(
      (formId): LaunchVariantForm[] => {
        const variant = variantFormById.get(formId);
        const assignment = variantByFormId.get(formId);
        if (!variant || !assignment) return [];
        const parsedSchema = formSchema.safeParse(variant.schema);
        if (!parsedSchema.success) {
          errors.push(`${action.name}: a variant form's schema is invalid.`);
          return [];
        }
        return [
          {
            formId,
            name: assignment.name,
            share: assignment.splitValue,
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
        variantForms.map(({ formId, snapshotId, name, share }) => [
          formId,
          snapshotId,
          name,
          share,
        ]),
      ]),
      readingSeconds: Math.max(
        ...[schema, ...variantForms.map((variant) => variant.schema)].map(
          (read) => readingTime(action, read).totalSeconds,
        ),
      ),
      taskFormSchema: schema,
      variantForms,
      memberIds: cohort ?? null,
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
  // Arms are regular actions, so their members are contracted ones.
  const reachable =
    users.data && awayData
      ? users.data
          .filter((user) => contracted.has(user.id) && !away.has(user.id))
          .map((user) => user.id)
      : null;
  const reachableIds = new Set(reachable);
  const splitPreviews = (splitsResult.data ?? []).map((split, index) => {
    const filtered = split.filterExpression
      ? splitFilterResults[index].data?.userIds
      : reachable;
    return splitPreview({
      split,
      cohortByActionId,
      reached:
        reachable && filtered
          ? filtered.filter((userId) => reachableIds.has(userId))
          : null,
    });
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
    ...(variantListResults.some((result) => result.isError)
      ? ["Failed to load the actions' variants."]
      : []),
    ...(users.isError ? ["Failed to load members' contract status."] : []),
    ...(splitsResult.isError ? ["Failed to load the suite's splits."] : []),
    ...(splitsResult.data ?? []).flatMap((split, index) =>
      splitFilterResults[index].isError
        ? [`Failed to evaluate the filter of the split ${split.title}.`]
        : [],
    ),
    ...(awayRanges.isError ? ["Failed to load members' away dates."] : []),
    ...(spellchecker.isError
      ? ["Failed to load the spelling dictionary."]
      : []),
  ];

  return {
    actions,
    loads,
    recipientCount: loads ? loads.length : null,
    splits:
      splitsResult.data &&
      splitPreviews.every(
        (preview): preview is SplitPreview => preview !== null,
      )
        ? splitPreviews
        : null,
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
      ...variantListResults,
      users,
      awayRanges,
      splitsResult,
      ...splitFilterResults,
    ].some((result) => result.isPending && result.fetchStatus !== "idle"),
    spellcheckLoading: spellchecker.isLoading,
    refetch: () => {
      for (const result of [
        ...actionResults,
        ...formResults,
        ...cohortResults,
        actionList,
        ...variantResults,
        ...variantListResults,
        users,
        awayRanges,
        splitsResult,
        ...splitFilterResults,
      ])
        // A disabled (skipToken) query rejects a refetch with "Missing queryFn".
        if (!(result.isPending && result.fetchStatus === "idle"))
          void result.refetch();
    },
  };
}
