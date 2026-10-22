import React from "react";
import { useActionMergedResponsesAdmin } from "../lib/useActionMergedResponsesAdmin";
import { useRefusalToast } from "../lib/useRefusalToast";
import FormResponsesView, { REFRESH_ERROR } from "./FormResponsesView";

export interface ActionMergedResponsesTabProps {
  actionId: number;
  /** Search-param namespace, so this view doesn't clash with the host page. */
  paramNamespace?: string;
}

const ActionMergedResponsesTab: React.FC<ActionMergedResponsesTabProps> = ({
  actionId,
  paramNamespace,
}) => {
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
  } = useActionMergedResponsesAdmin(actionId);
  const refusalToast = useRefusalToast();

  // Only surface the variant filter / per-response variant tags when the action
  // actually has variants beyond its default form.
  const hasVariants = (variantOptions?.length ?? 0) > 1;

  const title = baseForm?.title
    ? hasVariants
      ? `${baseForm.title} — all variants`
      : baseForm.title
    : "Form Responses";

  const exportFileBase = baseForm?.title
    ? hasVariants
      ? `${baseForm.title}-all-variants`
      : baseForm.title
    : `action-${actionId}-responses`;

  return (
    <FormResponsesView
      title={title}
      form={baseForm}
      responses={responses}
      loading={loading}
      error={error}
      onRefresh={() =>
        refresh.mutate(undefined, {
          onError: (e) => refusalToast(e, REFRESH_ERROR),
        })
      }
      withdrawnUserMap={withdrawnUserMap}
      sidsToUserMap={sidsToUserMap}
      referralsError={referralsError}
      exportFileBase={exportFileBase}
      snapshotTargets={variantOptions ?? []}
      variantOptions={hasVariants ? variantOptions : undefined}
      paramNamespace={paramNamespace}
    />
  );
};

export default ActionMergedResponsesTab;
