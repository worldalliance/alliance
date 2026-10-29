import {
  formSchema,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import type { ActionSuiteDto } from "@alliance/shared/client";
import { actionAdminQuery } from "@alliance/shared/lib/useActionAdmin";
import { useActionsAdmin } from "@alliance/shared/lib/useActionsAdmin";
import { adminTaskFormQuery } from "@alliance/shared/lib/useTaskForm";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { useQueries, useQuery } from "@tanstack/react-query";
import { cohortEvaluationQuery } from "../../lib/useCohortEvaluationAdmin";
import { useUsersAdmin } from "../../lib/useUsersAdmin";
import {
  actionReadinessItems,
  readingTime,
  type ReadinessCheckItem,
} from "../../pages/action-dashboard/actionReadiness";
import { actionTextFindings, type TextFinding } from "./actionTextFindings";
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
  taskFormSchema: FormSchema | null;
  /** Null until the cohort is evaluated. */
  memberIds: number[] | null;
};

export type SuiteLaunchData = {
  actions: LaunchAction[];
  loads: MemberLoad[];
  recipientCount: number;
  /** Each recipient's saved zone, null when they've saved none. */
  recipientTimeZones: (string | null)[];
  textFindings: TextFinding[];
  errors: string[];
  loading: boolean;
  spellcheckLoading: boolean;
  refetch: () => void;
};

export function useSuiteLaunchData(suite: ActionSuiteDto): SuiteLaunchData {
  const actionResults = useQueries({
    queries: suite.actions.map((action) => actionAdminQuery(action.id)),
  });
  const parsed = actionResults.map((result) => result.data);
  const formResults = useQueries({
    queries: parsed.map((entry) =>
      adminTaskFormQuery(entry?.action.taskFormId ?? undefined),
    ),
  });
  const cohortResults = useQueries({
    queries: parsed.map((entry) =>
      cohortEvaluationQuery(entry?.action.cohortExpression),
    ),
  });
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
  const contracted = new Set(
    (users.data ?? [])
      .filter((user) => user.hasActiveContract)
      .map((user) => user.id),
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
    const form = formResults[index].data;
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
    const evaluated = cohortResults[index].data?.userIds;
    // The server admits a regular action's member only while they hold a contract.
    const cohort =
      evaluated && !action.onboarding
        ? evaluated.filter((userId) => contracted.has(userId))
        : evaluated;
    if (cohort) cohortByActionId.set(action.id, cohort);
    actions.push({
      action,
      unready: actionReadinessItems(action, schema).filter(
        (item) => !item.isReady,
      ),
      memberCount: cohort ? cohort.length : null,
      reviewVersion: [
        `${action.updatedAt}|${form?.formSnapshotId ?? ""}`,
        ...variantForms.map(
          ({ formId, snapshotId }) => `${formId}:${snapshotId}`,
        ),
      ].join("|"),
      readingSeconds: Math.max(
        ...[schema, ...variantForms.map((variant) => variant.schema)].map(
          (read) => readingTime(action, read).totalSeconds,
        ),
      ),
      taskFormSchema: schema,
      memberIds: cohort ?? null,
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
  const loads = memberLoads({
    actions: actions.map(({ action }) => action),
    cohortByActionId,
  });

  const loadErrors = [
    ...actionResults.flatMap((result, index) =>
      result.isError
        ? [`Failed to load action ${suite.actions[index].name}.`]
        : [],
    ),
    ...formResults.flatMap((result, index) =>
      result.isError
        ? [`Failed to load the task form for ${suite.actions[index].name}.`]
        : [],
    ),
    ...cohortResults.flatMap((result, index) =>
      result.isError
        ? [`Failed to evaluate the cohort for ${suite.actions[index].name}.`]
        : [],
    ),
    ...(actionList.isError
      ? ["Failed to load the actions' variant forms."]
      : []),
    ...variantResults.flatMap((result) =>
      result.isError ? ["Failed to load a variant form."] : [],
    ),
    ...(users.isError ? ["Failed to load members' contract status."] : []),
    ...(spellchecker.isError
      ? ["Failed to load the spelling dictionary."]
      : []),
  ];

  return {
    actions,
    loads,
    recipientCount: loads.length,
    recipientTimeZones: loads.map(
      ({ userId }) => timeZoneByUserId.get(userId) ?? null,
    ),
    textFindings,
    errors: [...loadErrors, ...errors],
    loading: [
      ...actionResults,
      ...formResults,
      ...cohortResults,
      actionList,
      ...variantResults,
      users,
    ].some((result) => result.isLoading),
    spellcheckLoading: spellchecker.isLoading,
    refetch: () => {
      for (const result of [
        ...actionResults,
        ...formResults,
        ...cohortResults,
        actionList,
        ...variantResults,
        users,
      ])
        void result.refetch();
    },
  };
}
