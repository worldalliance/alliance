import { forCount, withCount } from "@alliance/common/plural";
import type { ActionDto } from "@alliance/shared/client";
import type {
  ActionFormVariantDto,
  ActionFormVariantsListDto,
} from "@alliance/shared/client/types.gen";
import { CardStyle } from "@alliance/shared/styles/card";
import BaseButton, {
  BaseButtonVariant,
} from "@alliance/sharedweb/ui/BaseButton";
import Card from "@alliance/sharedweb/ui/Card";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { formatPct } from "../lib/formatPct";
import { makeTempId } from "../lib/tempId";
import {
  formVariantsLoadError,
  useFormVariantsAdmin,
} from "../lib/useFormVariantsAdmin";
import { useRefusalToast } from "../lib/useRefusalToast";
import ActionFormVariantCoverage from "./ActionFormVariantCoverage";

export interface ActionFormVariantsTabProps {
  action: ActionDto;
}

interface EditState {
  name: string;
  splitValue: number;
}

interface StagedVariant {
  tempId: string;
  name: string;
  splitValue: number;
}

const asPercentages = (list: ActionFormVariantsListDto) => ({
  variants: list.variants.map((v) => ({
    ...v,
    splitValue: v.splitValue * 100,
  })),
  stats: list.stats.map((s) => ({
    ...s,
    splitValue: s.splitValue == null ? null : s.splitValue * 100,
  })),
});

const NO_VARIANTS: ActionFormVariantDto[] = [];

export default function ActionFormVariantsTab({
  action,
}: ActionFormVariantsTabProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const toastRefusal = useRefusalToast();
  const {
    variants: variantsQuery,
    publishVariants,
    updateVariant,
    deleteVariant,
  } = useFormVariantsAdmin(action.id, asPercentages);
  const [edits, setEdits] = useState<Record<number, EditState>>({});
  const [staged, setStaged] = useState<StagedVariant[]>([]);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const publishing = publishVariants.isPending;

  const variants = variantsQuery.data?.variants ?? NO_VARIANTS;
  const stats = variantsQuery.data?.stats ?? [];

  const percentageSum = useMemo(
    () =>
      [
        ...variants.map((v) => v.splitValue),
        ...staged.map((v) => v.splitValue),
      ].reduce((s, x) => s + x, 0),
    [variants, staged],
  );
  const hasUnpublished = staged.length > 0;

  const handleAddStaged = useCallback(() => {
    if (!action.taskFormId) {
      toast.error(
        "Set the action's task form first — variants are cloned from it.",
      );
      return;
    }
    setStaged((s) => {
      const currentPctSum = [
        ...variants.map((v) => v.splitValue),
        ...s.map((v) => v.splitValue),
      ].reduce((sum, n) => sum + n, 0);
      const remaining = Math.max(0, 100 - currentPctSum);
      const defaultPct = Math.min(remaining, 50);
      return [
        ...s,
        {
          tempId: makeTempId(),
          name: `Variant ${String.fromCharCode(
            65 + variants.length + s.length,
          )}`,
          splitValue: defaultPct,
        },
      ];
    });
  }, [action.taskFormId, toast, variants]);

  const updateStaged = useCallback(
    (tempId: string, patch: Partial<Omit<StagedVariant, "tempId">>) => {
      setStaged((s) =>
        s.map((d) => (d.tempId === tempId ? { ...d, ...patch } : d)),
      );
    },
    [],
  );

  const handleRemoveStaged = useCallback((tempId: string) => {
    setStaged((s) => s.filter((d) => d.tempId !== tempId));
  }, []);

  const handlePublishStaged = async () => {
    if (staged.length === 0) return;
    const sourceFormId = action.taskFormId;
    if (!sourceFormId) {
      toast.error("Set the action's task form first.");
      return;
    }
    if (percentageSum > 100) {
      toast.error(
        `Percentages sum to ${formatPct(percentageSum)} — must be at most 100% before publishing.`,
      );
      return;
    }
    const { published, refusal } = await publishVariants.mutateAsync(
      staged.map((draft) => ({
        name: draft.name,
        splitValue: draft.splitValue / 100,
        sourceFormId,
      })),
    );
    if (refusal) {
      toastRefusal(refusal, `Failed to publish "${staged[published].name}"`);
    }
    if (published > 0) {
      toast.success(`Published ${withCount(published, "variant")}`);
    }
    // Keep the refused draft and any after it.
    setStaged((s) => s.slice(published));
  };

  const editOf = (v: ActionFormVariantDto, all = edits): EditState =>
    all[v.id] ?? { name: v.name, splitValue: v.splitValue };

  const updateEdit = (v: ActionFormVariantDto, patch: Partial<EditState>) => {
    setEdits((d) => ({ ...d, [v.id]: { ...editOf(v, d), ...patch } }));
  };

  const handleSaveVariant = async (v: ActionFormVariantDto) => {
    const edit = editOf(v);
    setSavingIds((s) => new Set(s).add(v.id));
    try {
      await updateVariant.mutateAsync({
        variantId: v.id,
        body: { name: edit.name, splitValue: edit.splitValue / 100 },
      });
    } catch (error) {
      toastRefusal(error, "Failed to save");
    } finally {
      setSavingIds((s) => {
        const next = new Set(s);
        next.delete(v.id);
        return next;
      });
    }
  };

  const handleDeleteVariant = async (variantId: number) => {
    if (
      !window.confirm(
        "Delete this variant? Before launch, this also removes users' assignments to it. After launch, it's blocked if any users are assigned.",
      )
    )
      return;
    setDeletingIds((s) => new Set(s).add(variantId));
    try {
      await deleteVariant.mutateAsync(variantId);
    } catch (error) {
      toastRefusal(error, "Failed to delete");
    } finally {
      setDeletingIds((s) => {
        const next = new Set(s);
        next.delete(variantId);
        return next;
      });
    }
  };

  if (variantsQuery.isPending) {
    return <div className="text-zinc-500">Loading variants…</div>;
  }
  // A failed refetch keeps the list and the staged drafts on screen.
  if (!variantsQuery.data) {
    return (
      <div className="text-red-500">
        {formVariantsLoadError(variantsQuery.error)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {variantsQuery.isError && (
        <div className="text-red-500">
          {formVariantsLoadError(variantsQuery.error)}
        </div>
      )}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Form variants (A/B testing)</h2>
          <p className="text-sm text-zinc-600 mt-1 max-w-2xl">
            Stage variants here, then publish them all at once. Until you click
            &quot;Publish drafts&quot;, no users are assigned and no forms are
            cloned. Once published, assignments are sticky — a user always sees
            the same variant.
          </p>
        </div>
        <div className="flex gap-2">
          <BaseButton
            variant={BaseButtonVariant.White}
            onClick={() => navigate(`/actions/${action.id}?tab=responses`)}
          >
            View responses
          </BaseButton>
          <BaseButton
            variant={BaseButtonVariant.BlueOutline}
            onClick={handleAddStaged}
            disabled={publishing || !action.taskFormId}
          >
            Add variant
          </BaseButton>
          <BaseButton
            variant={BaseButtonVariant.Blue}
            onClick={handlePublishStaged}
            disabled={publishing || !hasUnpublished || percentageSum > 100}
          >
            {publishing
              ? "Publishing…"
              : hasUnpublished
                ? `Publish drafts (${staged.length})`
                : "Publish drafts"}
          </BaseButton>
        </div>
      </div>

      {!action.taskFormId && (
        <Card style={CardStyle.Alert} className="p-4 text-sm">
          Set the action&apos;s task form (in the &quot;Task Form&quot; tab)
          before creating variants. Variants are seeded by cloning the existing
          form.
        </Card>
      )}

      {hasUnpublished && (
        <Card style={CardStyle.Alert} className="p-4 text-sm">
          You have {staged.length} unpublished{" "}
          {forCount(staged.length, "variant")}. Nothing is sent to the server
          until you click &quot;Publish drafts&quot;. Refreshing this page will
          discard staged variants.
        </Card>
      )}

      <ActionFormVariantCoverage
        stats={stats}
        percentageSum={percentageSum}
        hasVariants={variants.length > 0 || hasUnpublished}
      />

      {(staged.length > 0 || variants.length > 0) && (
        <Card style={CardStyle.White} className="p-4">
          <h3 className="font-semibold mb-3">Variants</h3>
          <div className="text-xs text-zinc-500 mb-3">
            For published variants, saving a split only affects new assignments
            — existing users keep their current variant.
          </div>
          <div className="space-y-3">
            {staged.map((draft) => (
              <div
                key={draft.tempId}
                className="flex flex-wrap items-center gap-2 border border-blue-200 bg-blue-50/40 rounded-md p-3"
              >
                <span className="text-xs font-medium text-blue-700 px-2 py-0.5 bg-blue-100 rounded">
                  Staged
                </span>
                <input
                  className="border border-zinc-300 rounded-md px-2 py-1 w-40"
                  value={draft.name}
                  onChange={(e) =>
                    updateStaged(draft.tempId, { name: e.target.value })
                  }
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  className="border border-zinc-300 rounded-md px-2 py-1 w-24"
                  value={draft.splitValue}
                  onChange={(e) =>
                    updateStaged(draft.tempId, {
                      splitValue: Number(e.target.value),
                    })
                  }
                />
                <span className="text-xs text-zinc-500">% of new joiners</span>
                <BaseButton
                  variant={BaseButtonVariant.RedOutline}
                  onClick={() => handleRemoveStaged(draft.tempId)}
                  disabled={publishing}
                >
                  Remove
                </BaseButton>
              </div>
            ))}
            {variants.map((v) => {
              const edit = editOf(v);
              const dirty =
                edit.name !== v.name || edit.splitValue !== v.splitValue;
              return (
                <div
                  key={v.id}
                  className="flex flex-wrap items-center gap-2 border border-zinc-200 rounded-md p-3"
                >
                  <input
                    className="border border-zinc-300 rounded-md px-2 py-1 w-40"
                    value={edit.name}
                    onChange={(e) => updateEdit(v, { name: e.target.value })}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    className="border border-zinc-300 rounded-md px-2 py-1 w-24"
                    value={edit.splitValue}
                    onChange={(e) =>
                      updateEdit(v, {
                        splitValue: Number(e.target.value),
                      })
                    }
                  />
                  <span className="text-xs text-zinc-500">
                    % of new joiners
                  </span>
                  <BaseButton
                    variant={BaseButtonVariant.BlueOutline}
                    onClick={() => navigate(`/forms/${v.formId}`)}
                  >
                    Edit form
                  </BaseButton>
                  <BaseButton
                    variant={BaseButtonVariant.Blue}
                    onClick={() => handleSaveVariant(v)}
                    disabled={!dirty || savingIds.has(v.id)}
                  >
                    {savingIds.has(v.id) ? "Saving…" : "Save"}
                  </BaseButton>
                  <BaseButton
                    variant={BaseButtonVariant.RedOutline}
                    onClick={() => handleDeleteVariant(v.id)}
                    disabled={deletingIds.has(v.id)}
                  >
                    {deletingIds.has(v.id) ? "Deleting…" : "Delete"}
                  </BaseButton>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
