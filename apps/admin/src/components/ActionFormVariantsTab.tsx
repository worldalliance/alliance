import { errorMessage } from "@alliance/common/errorMessage";
import type { ActionDto } from "@alliance/shared/client";
import {
  actionsCreateFormVariantAdmin,
  actionsDeleteFormVariantAdmin,
  actionsListFormVariantsAdmin,
  actionsUpdateFormVariantAdmin,
} from "@alliance/shared/client";
import type {
  ActionFormVariantDto,
  ActionFormVariantStatsDto,
} from "@alliance/shared/client/types.gen";
import { CardStyle } from "@alliance/shared/styles/card";
import BaseButton, {
  BaseButtonVariant,
} from "@alliance/sharedweb/ui/BaseButton";
import Card from "@alliance/sharedweb/ui/Card";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { makeTempId } from "../lib/tempId";

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

function formatPct(value: number): string {
  return `${+value.toFixed(2)}%`;
}

export default function ActionFormVariantsTab({
  action,
}: ActionFormVariantsTabProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const [variants, setVariants] = useState<ActionFormVariantDto[]>([]);
  const [stats, setStats] = useState<ActionFormVariantStatsDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [edits, setEdits] = useState<Record<number, EditState>>({});
  const [staged, setStaged] = useState<StagedVariant[]>([]);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

  const refresh = useCallback(async () => {
    const res = await actionsListFormVariantsAdmin({ path: { id: action.id } });
    if (res.data) {
      const variantsAsPct = res.data.variants.map((v) => ({
        ...v,
        splitValue: v.splitValue * 100,
      }));
      const statsAsPct = res.data.stats.map((s) => ({
        ...s,
        splitValue: s.splitValue == null ? null : s.splitValue * 100,
      }));
      setVariants(variantsAsPct);
      setStats(statsAsPct);
      setEdits((prev) => {
        const next: Record<number, EditState> = {};
        for (const v of variantsAsPct) {
          next[v.id] =
            prev[v.id] ??
            ({
              name: v.name,
              splitValue: v.splitValue,
            } satisfies EditState);
        }
        return next;
      });
    }
    setLoading(false);
  }, [action.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const totalAssigned = useMemo(
    () => stats.reduce((sum, s) => sum + s.assigned, 0),
    [stats],
  );
  const totalSubmitted = useMemo(
    () => stats.reduce((sum, s) => sum + s.submitted, 0),
    [stats],
  );
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

  const handlePublishStaged = useCallback(async () => {
    if (staged.length === 0) return;
    if (!action.taskFormId) {
      toast.error("Set the action's task form first.");
      return;
    }
    if (percentageSum > 100) {
      toast.error(
        `Percentages sum to ${formatPct(percentageSum)} — must be at most 100% before publishing.`,
      );
      return;
    }
    setPublishing(true);
    try {
      let succeeded = 0;
      let stopAt = staged.length;
      for (let i = 0; i < staged.length; i++) {
        const draft = staged[i];
        const res = await actionsCreateFormVariantAdmin({
          path: { id: action.id },
          body: {
            name: draft.name,
            splitValue: draft.splitValue / 100,
            sourceFormId: action.taskFormId,
          },
        });
        if (res.error) {
          toast.error(
            errorMessage({
              error: res.error,
              fallback: `Failed to publish "${draft.name}"`,
            }),
          );
          stopAt = i;
          break;
        }
        succeeded++;
      }
      if (succeeded > 0) {
        toast.success(
          `Published ${succeeded} variant${succeeded === 1 ? "" : "s"}`,
        );
      }
      // Drop everything we successfully wrote; keep the failed one and any after it.
      setStaged((s) => s.slice(stopAt));
      await refresh();
    } finally {
      setPublishing(false);
    }
  }, [action.id, action.taskFormId, percentageSum, refresh, staged, toast]);

  const updateEdit = useCallback(
    (variantId: number, patch: Partial<EditState>) => {
      setEdits((d) => ({
        ...d,
        [variantId]: { ...d[variantId], ...patch },
      }));
    },
    [],
  );

  const handleSaveVariant = useCallback(
    async (variantId: number) => {
      const edit = edits[variantId];
      if (!edit) return;
      setSavingIds((s) => new Set(s).add(variantId));
      try {
        const res = await actionsUpdateFormVariantAdmin({
          path: { variantId },
          body: {
            name: edit.name,
            splitValue: edit.splitValue / 100,
          },
        });
        if (res.error) {
          toast.error(
            errorMessage({ error: res.error, fallback: "Failed to save" }),
          );
        } else {
          await refresh();
        }
      } finally {
        setSavingIds((s) => {
          const next = new Set(s);
          next.delete(variantId);
          return next;
        });
      }
    },
    [edits, refresh, toast],
  );

  const handleDeleteVariant = useCallback(
    async (variantId: number) => {
      if (
        !window.confirm(
          "Delete this variant? This is hard-blocked if any users are already assigned to it.",
        )
      )
        return;
      setDeletingIds((s) => new Set(s).add(variantId));
      try {
        const res = await actionsDeleteFormVariantAdmin({
          path: { variantId },
        });
        if (res.error) {
          toast.error(
            errorMessage({ error: res.error, fallback: "Failed to delete" }),
          );
        } else {
          await refresh();
        }
      } finally {
        setDeletingIds((s) => {
          const next = new Set(s);
          next.delete(variantId);
          return next;
        });
      }
    },
    [refresh, toast],
  );

  if (loading) {
    return <div className="text-zinc-500">Loading variants…</div>;
  }

  return (
    <div className="space-y-6">
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
          You have {staged.length} unpublished variant
          {staged.length === 1 ? "" : "s"}. Nothing is sent to the server until
          you click &quot;Publish drafts&quot;. Refreshing this page will
          discard staged variants.
        </Card>
      )}

      <Card style={CardStyle.White} className="p-4">
        <div className="text-sm text-zinc-600 mb-3">
          Coverage:{" "}
          <span className="font-medium text-zinc-900">
            {totalAssigned} users assigned
          </span>{" "}
          across {stats.length} group{stats.length === 1 ? "" : "s"}.{" "}
          {percentageSum > 100 ? (
            <span className="text-red-600">
              Percentage total {formatPct(percentageSum)} exceeds 100% — fix
              splits before publishing.
            </span>
          ) : variants.length === 0 && !hasUnpublished ? (
            <span className="text-zinc-500">
              No variants — all users see the default form.
            </span>
          ) : (
            <span>
              Users are assigned the first time they load the action. Default
              form covers the remaining {formatPct(100 - percentageSum)}.
            </span>
          )}
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500 border-b">
              <th className="py-2 pr-3">Group</th>
              <th className="py-2 pr-3">Form</th>
              <th className="py-2 pr-3">Split</th>
              <th className="py-2 pr-3 text-right">Assigned</th>
              <th className="py-2 pr-3 text-right">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.variantId ?? "default"} className="border-b">
                <td className="py-2 pr-3 font-medium">
                  {s.variantId === null ? (
                    <span className="text-zinc-500">Default ·</span>
                  ) : null}{" "}
                  {s.name}
                </td>
                <td className="py-2 pr-3">
                  {s.formId != null ? (
                    <button
                      className="text-blue-600 hover:underline"
                      onClick={() => navigate(`/forms/${s.formId}`)}
                    >
                      Form #{s.formId}
                    </button>
                  ) : (
                    <span className="text-zinc-400">—</span>
                  )}
                </td>
                <td className="py-2 pr-3 text-zinc-700">
                  {s.splitValue != null ? formatPct(s.splitValue) : "remainder"}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {s.assigned}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {s.submitted}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} className="py-2 pr-3 text-right text-zinc-500">
                Total
              </td>
              <td className="py-2 pr-3 text-right tabular-nums font-medium">
                {totalAssigned}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums font-medium">
                {totalSubmitted}
              </td>
            </tr>
          </tbody>
        </table>
      </Card>

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
              const edit = edits[v.id];
              if (!edit) return null;
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
                    onChange={(e) => updateEdit(v.id, { name: e.target.value })}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    className="border border-zinc-300 rounded-md px-2 py-1 w-24"
                    value={edit.splitValue}
                    onChange={(e) =>
                      updateEdit(v.id, {
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
                    onClick={() => handleSaveVariant(v.id)}
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
