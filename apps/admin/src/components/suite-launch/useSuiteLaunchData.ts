import {
  formSchema,
  type FormSchema,
} from "@alliance/common/forms/form-schema";
import type { ActionSuiteDto } from "@alliance/shared/client";
import { actionAdminQuery } from "@alliance/shared/lib/useActionAdmin";
import { adminTaskFormQuery } from "@alliance/shared/lib/useTaskForm";
import type { ParsedActionDto } from "@alliance/shared/parsed-dtos";
import {
  hashKey,
  useQueries,
  useQuery,
  type QueryKey,
} from "@tanstack/react-query";
import { cohortEvaluationQuery } from "../../lib/useCohortEvaluationAdmin";
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

/** Each distinct query once, and each entry's slot among them. */
function distinctQueries<T extends { queryKey: QueryKey }>(queries: T[]) {
  const hashes = queries.map((query) => hashKey(query.queryKey));
  const distinctHashes = [...new Set(hashes)];
  return {
    queries: distinctHashes.map((hash) => queries[hashes.indexOf(hash)]),
    slots: hashes.map((hash) => distinctHashes.indexOf(hash)),
  };
}

export function useSuiteLaunchData(suite: ActionSuiteDto): SuiteLaunchData {
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
  const spellchecker = useQuery(spellcheckerQuery);

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
    const cohort = cohortResultOf(index).data;
    if (cohort) cohortByActionId.set(action.id, cohort.userIds);
    actions.push({
      action,
      unready: actionReadinessItems(action, schema).filter(
        (item) => !item.isReady,
      ),
      memberCount: cohort ? cohort.userIds.length : null,
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
    loading: [...actionResults, ...formResults, ...cohortResults].some(
      (result) => result.isLoading,
    ),
    spellcheckLoading: spellchecker.isLoading,
    refetch: () => {
      for (const result of [...actionResults, ...formResults, ...cohortResults])
        // A disabled (skipToken) query rejects a refetch with "Missing queryFn".
        if (!(result.isPending && result.fetchStatus === "idle"))
          void result.refetch();
    },
  };
}
