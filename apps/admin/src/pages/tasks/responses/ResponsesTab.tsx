import FormResponsesView from "../../../components/FormResponsesView";
import { useActionMergedResponsesAdmin } from "../../../lib/useActionMergedResponsesAdmin";
import type { TaskTabProps } from "../taskTabs";

/** The `resp_` search params are the Overview tab's way in with a filter. */
const PARAM_NAMESPACE = "resp";

export function ResponsesTab({ task }: Pick<TaskTabProps, "task">) {
  const {
    variantOptions,
    form: baseForm,
    responses,
    sidsToUserMap,
    referralsError,
    withdrawnUserMap,
    loading,
    error,
    refresh,
  } = useActionMergedResponsesAdmin(task.id);

  // The variant filter and per-response variant tags show only when the task
  // has variants beyond its default form.
  const hasVariants = (variantOptions?.length ?? 0) > 1;

  const formTitle = baseForm?.title;
  const title = formTitle
    ? hasVariants
      ? `${formTitle} — all variants`
      : formTitle
    : "Form responses";
  const exportFileBase = formTitle
    ? hasVariants
      ? `${formTitle}-all-variants`
      : formTitle
    : `task-${task.id}-responses`;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto">
      <FormResponsesView
        title={title}
        form={baseForm}
        responses={responses}
        loading={loading}
        error={error}
        refresh={refresh}
        withdrawnUserMap={withdrawnUserMap}
        sidsToUserMap={sidsToUserMap}
        referralsError={referralsError}
        exportFileBase={exportFileBase}
        snapshotTargets={variantOptions ?? []}
        variantOptions={hasVariants ? variantOptions : undefined}
        paramNamespace={PARAM_NAMESPACE}
      />
    </div>
  );
}
