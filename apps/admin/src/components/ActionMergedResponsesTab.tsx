import {
  actionsGetWithdrawalsAdmin,
  actionsListFormVariantsAdmin,
  actionsShareLinksForFormAdmin,
  tasksGetForm,
  tasksGetFormResponsesByFormsAdmin,
  type ActionWithdrawalDto,
  type FormResponseDto,
  type ProfileDto,
} from "@alliance/shared/client";
import React, { useCallback, useEffect, useState } from "react";
import FormResponsesView, {
  sortResponsesByCreatedAtAsc,
  type FormWithSchema,
  type ResponseVariantOption,
} from "./FormResponsesView";

type SchemaField = { id?: string; kind?: string; label?: string };
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
      if (typeof field?.id === "string") seen.add(field.id);
    }
  }

  const extraFields: SchemaField[] = [];
  for (const form of allForms) {
    if (form.id === defaultForm.id) continue;
    const schema = form.schema as unknown as SchemaShape;
    for (const page of schema.pages ?? []) {
      for (const field of page.fields ?? []) {
        if (typeof field?.id === "string" && !seen.has(field.id)) {
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
  const [baseForm, setBaseForm] = useState<FormWithSchema | null>(null);
  const [responses, setResponses] = useState<FormResponseDto[]>([]);
  const [variantOptions, setVariantOptions] = useState<ResponseVariantOption[]>(
    [],
  );
  const [withdrawnUserMap, setWithdrawnUserMap] = useState<
    Map<number, ActionWithdrawalDto>
  >(new Map());
  const [sidsToUserMap, setSidsToUserMap] = useState<
    Record<string, ProfileDto>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const variantsRes = await actionsListFormVariantsAdmin({
        path: { id: actionId },
      });
      const stats = variantsRes.data?.stats ?? [];

      // One option per form that actually exists (default + each variant).
      const options: ResponseVariantOption[] = stats
        .filter((s): s is typeof s & { formId: number } => s.formId != null)
        .map((s) => ({
          key: s.variantId == null ? "default" : String(s.variantId),
          variantId: s.variantId,
          formId: s.formId,
          name: s.variantId == null ? "Default" : s.name,
        }));

      const formIds = options.map((o) => o.formId);
      const defaultOption =
        options.find((o) => o.variantId == null) ?? options[0];

      // Withdrawals and share links resolve to the owning action, so they're
      // identical for every variant form — fetch them once (via any form id)
      // rather than fanning out per form. Form schemas are fetched per form so
      // the aggregate views can union variant-only fields; responses come back
      // in a single batched request.
      const anchorFormId = defaultOption?.formId;
      const [formResults, respRes, withdrawalRes, shareLinkRes] =
        await Promise.all([
          formIds.length > 0
            ? Promise.all(formIds.map((id) => tasksGetForm({ path: { id } })))
            : Promise.resolve([]),
          formIds.length > 0
            ? tasksGetFormResponsesByFormsAdmin({ body: { formIds } })
            : Promise.resolve(null),
          anchorFormId != null
            ? actionsGetWithdrawalsAdmin({ path: { formId: anchorFormId } })
            : Promise.resolve(null),
          anchorFormId != null
            ? actionsShareLinksForFormAdmin({ path: { formId: anchorFormId } })
            : Promise.resolve(null),
        ]);

      const forms = formResults
        .map((res) => (res?.data as unknown as FormWithSchema) ?? null)
        .filter((form): form is FormWithSchema => form != null);
      const defaultForm =
        forms.find((form) => form.id === defaultOption?.formId) ??
        forms[0] ??
        null;

      setBaseForm(defaultForm ? mergeVariantFields(defaultForm, forms) : null);
      setVariantOptions(options);

      setResponses(sortResponsesByCreatedAtAsc(respRes?.data ?? []));

      const withdrawals = new Map<number, ActionWithdrawalDto>();
      for (const withdrawal of withdrawalRes?.data ?? []) {
        withdrawals.set(withdrawal.userId, withdrawal);
      }
      setWithdrawnUserMap(withdrawals);

      const sids: Record<string, ProfileDto> = {};
      for (const link of shareLinkRes?.data ?? []) {
        if (link.sid) sids[link.sid] = link.user;
      }
      setSidsToUserMap(sids);
    } catch (e) {
      console.error(e);
      setError("Failed to load form responses");
    } finally {
      setLoading(false);
    }
  }, [actionId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Only surface the variant filter / per-response variant tags when the action
  // actually has variants beyond its default form.
  const hasVariants = variantOptions.length > 1;

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
      onRefresh={loadData}
      withdrawnUserMap={withdrawnUserMap}
      sidsToUserMap={sidsToUserMap}
      exportFileBase={exportFileBase}
      variantOptions={hasVariants ? variantOptions : undefined}
      paramNamespace={paramNamespace}
    />
  );
};

export default ActionMergedResponsesTab;
