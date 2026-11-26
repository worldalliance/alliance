import type { ActionFormVariantDto } from "@alliance/shared/client/types.gen";
import { useState } from "react";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { countOf } from "../../../lib/formatNumber";
import { formatPct } from "../../../lib/formatPct";
import { useConfirmOnPage } from "../../../lib/useConfirmOnPage";
import {
  formVariantsLoadError,
  useFormVariantsAdmin,
} from "../../../lib/useFormVariantsAdmin";
import Button, { ButtonVariant } from "../../../ui/Button";
import { useToast } from "../../../ui/ToastProvider";
import { Banner, BannerTone } from "../../../ui/templates/Banner";
import { Panel } from "../../../ui/templates/Overview";
import {
  ContentState,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../../ui/templates/States";
import type { TaskTabProps } from "../taskTabs";
import { VariantCoverage } from "./VariantCoverage";
import { VariantRows } from "./VariantRows";
import {
  asPercentages,
  DELETE_VARIANT_MESSAGE,
  nextDraft,
  type StagedVariant,
  splitTotal as sumSplits,
  type VariantEdit,
} from "./variantRules";

const NO_VARIANTS: ActionFormVariantDto[] = [];

const without = <T,>(set: ReadonlySet<T>, item: T) => {
  const next = new Set(set);
  next.delete(item);
  return next;
};

export function VariantsTab({
  task,
  openTab,
  setError,
}: Pick<TaskTabProps, "task" | "openTab" | "setError">) {
  const toast = useToast();
  const confirm = useConfirmOnPage();
  const {
    variants: query,
    publishVariants,
    updateVariant,
    deleteVariant,
  } = useFormVariantsAdmin(task.id, asPercentages);
  const [edits, setEdits] = useState<Record<number, VariantEdit>>({});
  const [staged, setStaged] = useState<StagedVariant[]>([]);
  const [savingIds, setSavingIds] = useState<ReadonlySet<number>>(new Set());
  const [deletingIds, setDeletingIds] = useState<ReadonlySet<number>>(
    new Set(),
  );
  const publishing = publishVariants.isPending;

  const variants = query.data?.variants ?? NO_VARIANTS;
  const stats = query.data?.stats ?? [];
  const splitTotal = sumSplits({ variants, staged });
  const overLimit = splitTotal > 100;
  const sourceFormId = task.taskFormId;

  const editOf = (variant: ActionFormVariantDto): VariantEdit =>
    edits[variant.id] ?? { name: variant.name, splitValue: variant.splitValue };

  const editStaged = (tempId: string, patch: Partial<VariantEdit>) =>
    setStaged((all) =>
      all.map((d) => (d.tempId === tempId ? { ...d, ...patch } : d)),
    );

  const publish = async () => {
    if (staged.length === 0 || sourceFormId == null || overLimit) return;
    setError(null);
    const { published, refusal } = await publishVariants.mutateAsync(
      staged.map((draft) => ({
        name: draft.name,
        splitValue: draft.splitValue / 100,
        sourceFormId,
      })),
    );
    if (refusal) {
      setError(
        adminRefusalMessage(
          refusal,
          `Couldn't publish "${staged[published].name}".`,
        ),
      );
    }
    if (published > 0)
      toast.success(`Published ${countOf(published, "variant")}`);
    // The refused draft and every one after it stay staged.
    setStaged((all) => all.slice(published));
  };

  const save = async (variant: ActionFormVariantDto) => {
    const edit = editOf(variant);
    setError(null);
    setSavingIds((ids) => new Set(ids).add(variant.id));
    try {
      await updateVariant.mutateAsync({
        variantId: variant.id,
        body: { name: edit.name, splitValue: edit.splitValue / 100 },
      });
    } catch (error) {
      setError(adminRefusalMessage(error, `Couldn't save "${variant.name}".`));
    } finally {
      setSavingIds((ids) => without(ids, variant.id));
    }
  };

  const remove = async (variant: ActionFormVariantDto) => {
    const confirmed = await confirm({
      title: `Delete the variant “${variant.name}”?`,
      message: DELETE_VARIANT_MESSAGE,
      confirmLabel: "Delete variant",
      destructive: true,
    });
    if (!confirmed) return;
    setError(null);
    setDeletingIds((ids) => new Set(ids).add(variant.id));
    try {
      await deleteVariant.mutateAsync(variant.id);
    } catch (error) {
      setError(
        adminRefusalMessage(error, `Couldn't delete "${variant.name}".`),
      );
    } finally {
      setDeletingIds((ids) => without(ids, variant.id));
    }
  };

  return (
    <>
      <RefreshFailedBanner inline things="variants" query={query} />
      <ContentState
        loading={query.isPending}
        skeleton={<TableSkeleton columns={4} />}
        error={query.isLoadingError ? formVariantsLoadError(query.error) : null}
        errorTitle="Couldn't load variants"
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      >
        <Panel
          flush
          title="Form variants"
          action={
            <div className="flex gap-2">
              <Button
                variant={ButtonVariant.Default}
                disabled={publishing || sourceFormId == null}
                onClick={() =>
                  setStaged((all) => [
                    ...all,
                    nextDraft({ variants, staged: all }),
                  ])
                }
              >
                Add variant
              </Button>
              <Button
                variant={ButtonVariant.Primary}
                busy={publishing}
                disabled={staged.length === 0 || overLimit}
                onClick={() => void publish()}
              >
                {staged.length > 0
                  ? `Publish drafts (${staged.length})`
                  : "Publish drafts"}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3 border-b border-line p-card">
            <p className="max-w-prose">
              Split members between versions of this task&apos;s form to compare
              them. A member is assigned a variant at random, by these splits,
              the first time they load the task, and keeps it from then on. The
              default form covers whatever the splits leave.
            </p>
            <p className="max-w-prose text-fg-muted">
              Publishing a variant or changing a split changes which form
              members not yet assigned will get. Members already assigned keep
              theirs.
            </p>
            {sourceFormId == null && (
              <Banner inline tone={BannerTone.Warning}>
                Variants are copies of the task&apos;s form, and this task has
                none yet. Build it on the{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => openTab("form")}
                >
                  Form tab
                </button>{" "}
                first.
              </Banner>
            )}
            {staged.length > 0 && (
              <Banner inline tone={BannerTone.Warning}>
                {countOf(staged.length, "staged variant")} exist only in this
                browser. Nothing reaches the server until you publish them, and
                refreshing the page discards them.
              </Banner>
            )}
            {overLimit && (
              <Banner inline tone={BannerTone.Danger}>
                The splits total {formatPct(splitTotal)}, over the 100% limit.
                Lower one before publishing.
              </Banner>
            )}
          </div>
          {staged.length > 0 || variants.length > 0 ? (
            <VariantRows
              staged={staged}
              variants={variants}
              editOf={editOf}
              publishing={publishing}
              savingIds={savingIds}
              deletingIds={deletingIds}
              onEditStaged={editStaged}
              onRemoveStaged={(tempId) =>
                setStaged((all) => all.filter((d) => d.tempId !== tempId))
              }
              onEdit={(variant, patch) =>
                setEdits((all) => ({
                  ...all,
                  [variant.id]: { ...editOf(variant), ...patch },
                }))
              }
              onSave={(variant) => void save(variant)}
              onDelete={(variant) => void remove(variant)}
            />
          ) : (
            <p className="p-card text-fg-muted">
              No variants. Every member sees the default form.
            </p>
          )}
        </Panel>
        <VariantCoverage
          stats={stats}
          splitTotal={splitTotal}
          hasVariants={variants.length > 0 || staged.length > 0}
        />
      </ContentState>
    </>
  );
}
