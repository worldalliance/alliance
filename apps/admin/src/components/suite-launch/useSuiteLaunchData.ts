import {
  formSchema,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import type { ActionSuiteDto } from "@alliance/shared/client";
import { actionAdminQuery } from "@alliance/shared/lib/useActionAdmin";
import { adminTaskFormQuery } from "@alliance/shared/lib/useTaskForm";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import { useQueries, useQuery } from "@tanstack/react-query";
import { cohortEvaluationQuery } from "../../lib/useCohortEvaluationAdmin";
import { useUsersAdmin } from "../../lib/useUsersAdmin";
import {
  actionReadinessItems,
  type ReadinessCheckItem,
} from "../../pages/action-dashboard/actionReadiness";
import { actionTextFindings, type TextFinding } from "./actionTextFindings";
import { memberLoads, type MemberLoad } from "./memberLoad";
import { spellcheckerQuery } from "./spellchecker";

export type LaunchAction = {
  action: ParsedActionDto;
  unready: ReadinessCheckItem[];
  memberCount: number | null;
};

export type SuiteLaunchData = {
  actions: LaunchAction[];
  loads: MemberLoad[];
  recipientCount: number;
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
  const spellchecker = useQuery(spellcheckerQuery);
  const users = useUsersAdmin();
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
    });
    textFindings.push(
      ...actionTextFindings({
        action,
        taskFormSchema: schema,
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
    ...(users.isError ? ["Failed to load members' contract status."] : []),
    ...(spellchecker.isError
      ? ["Failed to load the spelling dictionary."]
      : []),
  ];

  return {
    actions,
    loads,
    recipientCount: loads.length,
    textFindings,
    errors: [...loadErrors, ...errors],
    loading: [...actionResults, ...formResults, ...cohortResults, users].some(
      (result) => result.isLoading,
    ),
    spellcheckLoading: spellchecker.isLoading,
    refetch: () => {
      for (const result of [...actionResults, ...formResults, ...cohortResults])
        void result.refetch();
    },
  };
}
