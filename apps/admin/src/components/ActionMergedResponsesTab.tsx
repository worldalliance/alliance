import {
  actionsShareLinksForFormAdmin,
  tasksGetForm,
  tasksGetFormResponsesByFormsAdmin,
  type ActionFormVariantsListDto,
  type FormResponseDto,
  type ProfileDto,
} from "@alliance/shared/client";
import { useFormWithdrawalsAdmin } from "@alliance/shared/lib/useFormWithdrawalsAdmin";
import React, { useCallback, useEffect, useState } from "react";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { sortResponsesByCreatedAtAsc } from "../lib/sortResponses";
import { useFormVariantsAdmin } from "../lib/useFormVariantsAdmin";
import FormResponsesView, {
  type FormWithSchema,
  type ResponseVariantOption,
} from "./FormResponsesView";

type SchemaField = {
  id?: string;
  kind?: string;
  label?: string;
  type?: string;
};
type SchemaShape = { pages?: Array<{ fields?: SchemaField[] }> };

/**
 * Union the fields across every variant form so the merged view's CSV export,
 * stats, questions and filters cover variant-only questions — not just the
 * default form's. The default form supplies the base schema (title, ordering,
 * outputViews …); fields that appear only in other variants are appended in a
 * synthetic page, deduped by field id. (Downstream consumers flatten fields
 * across pages, so the extra page is invisible; the per-response renderer uses
 * each response's own snapshot, so this only feeds the aggregate views.)
 */
const mergeVariantFields = (
  defaultForm: FormWithSchema,
  allForms: FormWithSchema[],
): FormWithSchema => {
  const baseSchema = defaultForm.schema as unknown as SchemaShape;
  const seen = new Set<string>();
  for (const page of baseSchema.pages ?? []) {
    for (const field of page.fields ?? []) {
      if (typeof field.id === "string") seen.add(field.id);
    }
  }

  const extraFields: SchemaField[] = [];
  for (const form of allForms) {
    if (form.id === defaultForm.id) continue;
    const schema = form.schema as unknown as SchemaShape;
    for (const page of schema.pages ?? []) {
      for (const field of page.fields ?? []) {
        if (typeof field.id === "string" && !seen.has(field.id)) {
          seen.add(field.id);
          extraFields.push(field);
        }
      }
    }
  }

  if (extraFields.length === 0) return defaultForm;

  return {
    ...defaultForm,
    schema: {
      ...(defaultForm.schema as unknown as object),
      pages: [
        ...(baseSchema.pages ?? []),
        { id: "__variant_extra_fields__", fields: extraFields },
      ],
    },
  } as unknown as FormWithSchema;
};

const LOAD_ERROR = "Failed to load form responses";

/** One option per form that actually exists (default + each variant). */
const variantOptionsOf = ({
  stats,
}: ActionFormVariantsListDto): ResponseVariantOption[] =>
  stats
    .filter((s): s is typeof s & { formId: number } => s.formId != null)
    .map((s) => ({
      key: s.variantId == null ? "default" : String(s.variantId),
      variantId: s.variantId,
      formId: s.formId,
      name: s.variantId == null ? "Default" : s.name,
    }));

const defaultOptionOf = (
  options: ResponseVariantOption[],
): ResponseVariantOption | undefined =>
  options.find((o) => o.variantId == null) ?? options[0];

export interface ActionMergedResponsesTabProps {
  actionId: number;
  /** Search-param namespace, so this view doesn't clash with the host page. */
  paramNamespace?: string;
}

/**
 * Merged responses across every form variant of an action (default form +
 * each A/B variant). Fans out the existing per-form endpoints and stitches the
 * results together, tagging each response with the variant it belongs to.
 */
const ActionMergedResponsesTab: React.FC<ActionMergedResponsesTabProps> = ({
  actionId,
  paramNamespace,
}) => {
  const { variants } = useFormVariantsAdmin(actionId, variantOptionsOf);
  const { data: variantOptions, refetch: refetchVariants } = variants;
  const [baseForm, setBaseForm] = useState<FormWithSchema | null>(null);
  const [responses, setResponses] = useState<FormResponseDto[]>([]);
  const [sidsToUserMap, setSidsToUserMap] = useState<
    Record<string, ProfileDto>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (!variantOptions) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const formIds = variantOptions.map((o) => o.formId);
        const defaultOption = defaultOptionOf(variantOptions);

        // Share links resolve to the owning action, so they're identical for
        // every variant form — fetch them once (via any form id) rather than
        // fanning out per form. Form schemas are fetched per form so
        // the aggregate views can union variant-only fields; responses come back
        // in a single batched request.
        const anchorFormId = defaultOption?.formId;
        const [formResults, respRes, shareLinkRes] = await Promise.all([
          formIds.length > 0
            ? Promise.all(
                formIds.map((id) =>
                  tasksGetForm({ path: { id }, throwOnError: true }),
                ),
              )
            : Promise.resolve([]),
          formIds.length > 0
            ? tasksGetFormResponsesByFormsAdmin({
                body: { formIds },
                throwOnError: true,
              })
            : Promise.resolve(null),
          anchorFormId != null
            ? actionsShareLinksForFormAdmin({
                path: { formId: anchorFormId },
                throwOnError: true,
              })
            : Promise.resolve(null),
        ]);
        if (cancelled) return;

        const forms = formResults.map(
          (res) => res.data as unknown as FormWithSchema,
        );
        const defaultForm =
          forms.find((form) => form.id === defaultOption?.formId) ??
          forms[0] ??
          null;

        setBaseForm(
          defaultForm ? mergeVariantFields(defaultForm, forms) : null,
        );

        setResponses(sortResponsesByCreatedAtAsc(respRes?.data ?? []));

        const sids: Record<string, ProfileDto> = {};
        for (const link of shareLinkRes?.data ?? []) {
          if (link.sid) sids[link.sid] = link.user;
        }
        setSidsToUserMap(sids);
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setError(adminRefusalMessage(e, LOAD_ERROR));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [variantOptions, reloads]);

  // Withdrawals resolve to the owning action too, so one form id covers every
  // variant.
  const {
    withdrawnUserMap,
    isLoading: withdrawalsLoading,
    isError: withdrawalsFailed,
    refresh: refreshWithdrawals,
  } = useFormWithdrawalsAdmin(defaultOptionOf(variantOptions ?? [])?.formId);

  const refresh = useCallback(() => {
    void refetchVariants();
    setReloads((n) => n + 1);
    void refreshWithdrawals();
  }, [refetchVariants, refreshWithdrawals]);

  const variantsFailure = variants.isLoadingError
    ? adminRefusalMessage(variants.error, LOAD_ERROR)
    : null;

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
      loading={
        !variantsFailure && (!variantOptions || loading || withdrawalsLoading)
      }
      error={
        variantsFailure ??
        error ??
        (withdrawalsFailed ? "Failed to load withdrawals" : null)
      }
      onRefresh={refresh}
      withdrawnUserMap={withdrawnUserMap}
      sidsToUserMap={sidsToUserMap}
      exportFileBase={exportFileBase}
      snapshotTargets={variantOptions ?? []}
      variantOptions={hasVariants ? variantOptions : undefined}
      paramNamespace={paramNamespace}
    />
  );
};

export default ActionMergedResponsesTab;
