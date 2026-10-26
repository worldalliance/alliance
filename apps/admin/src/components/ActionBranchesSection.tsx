import { withCount } from "@alliance/common/plural";
import type { ActionDto, ActionFormVariantDto } from "@alliance/shared/client";
import { parseActionFormVariantDto } from "@alliance/shared/parsed-dtos";
import { CardStyle } from "@alliance/shared/styles/card";
import BaseButton, {
  BaseButtonVariant,
} from "@alliance/sharedweb/ui/BaseButton";
import Card from "@alliance/sharedweb/ui/Card";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useMemo, useState } from "react";
import { useReroutePreviewAdmin } from "../lib/useFormAssignmentsAdmin";
import { useFormVariantsAdmin } from "../lib/useFormVariantsAdmin";
import { useRefusalToast } from "../lib/useRefusalToast";
import ActionBranchEditor, { type BranchFields } from "./ActionBranchEditor";
import type { CohortLeafEditorSources } from "./CohortLeafEditors";
import RerouteBranchesModal from "./RerouteBranchesModal";

const keepList = (list: { variants: ActionFormVariantDto[] }) => list.variants;

export default function ActionBranchesSection(props: {
  action: ActionDto;
  sources: CohortLeafEditorSources;
  activeContractUserIds?: Set<number>;
}) {
  const { action, sources, activeContractUserIds } = props;
  const toast = useToast();
  const toastRefusal = useRefusalToast();
  const {
    variants: variantsQuery,
    publishVariants,
    updateVariant,
    deleteVariant,
    reorderBranches,
  } = useFormVariantsAdmin(action.id, keepList);
  const [drafting, setDrafting] = useState(false);
  const [savingId, setSavingId] = useState<number | "draft" | null>(null);
  const [rerouteOpen, setRerouteOpen] = useState(false);

  const branches = useMemo(
    () => (variantsQuery.data ?? []).map(parseActionFormVariantDto),
    [variantsQuery.data],
  );
  const reroutePreview = useReroutePreviewAdmin({
    actionId: action.id,
    enabled: branches.length > 0,
  });
  const pendingMoves = reroutePreview.data?.length ?? 0;

  const create = async (fields: BranchFields) => {
    if (!action.taskFormId) return;
    setSavingId("draft");
    const { refusal } = await publishVariants.mutateAsync([
      { ...fields, sourceFormId: action.taskFormId },
    ]);
    setSavingId(null);
    if (refusal) {
      toastRefusal(refusal, "Failed to create the branch");
      return;
    }
    setDrafting(false);
    toast.success(`Created "${fields.name}"`);
  };

  const save = async (variantId: number, fields: BranchFields) => {
    setSavingId(variantId);
    try {
      await updateVariant.mutateAsync({ variantId, body: fields });
      toast.success(`Saved "${fields.name}"`);
    } catch (error) {
      toastRefusal(error, "Failed to save the branch");
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (variantId: number) => {
    if (
      !window.confirm(
        "Delete this branch? Before launch, this also removes members' routing to it. After launch, it's blocked if any members are on it.",
      )
    ) {
      return;
    }
    try {
      await deleteVariant.mutateAsync(variantId);
    } catch (error) {
      toastRefusal(error, "Failed to delete the branch");
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const ids = branches.map(({ variant }) => variant.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    try {
      await reorderBranches.mutateAsync(ids);
    } catch (error) {
      toastRefusal(error, "Failed to reorder the branches");
    }
  };

  if (variantsQuery.isPending) {
    return <div className="text-zinc-500">Loading branches…</div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600 max-w-2xl">
        Each member of the action&apos;s cohort is routed once, when their
        cohort decision is made, to the first branch whose rule they match.
        Members matching no branch aren&apos;t assigned the action.
      </p>

      {pendingMoves > 0 && (
        <Card
          style={CardStyle.Alert}
          className="p-4 text-sm flex items-center justify-between gap-4"
        >
          <span>
            With the current rules, {withCount(pendingMoves, "member")} who
            {pendingMoves === 1 ? " hasn't" : " haven't"} submitted would be on
            a different branch. Nobody moves until you re-route.
          </span>
          <BaseButton
            variant={BaseButtonVariant.Blue}
            onClick={() => setRerouteOpen(true)}
          >
            Re-route members
          </BaseButton>
        </Card>
      )}

      {branches.map(({ variant, ruleError }, index) => (
        <ActionBranchEditor
          key={`${variant.id}:${variant.updatedAt}`}
          actionId={action.id}
          branch={variant}
          earlierRules={branches
            .slice(0, index)
            .map(({ variant: earlier }) => earlier.rule ?? null)}
          activeContractUserIds={activeContractUserIds}
          ruleError={ruleError !== null}
          sources={sources}
          saving={savingId === variant.id}
          onSave={(fields) => save(variant.id, fields)}
          onDelete={() => remove(variant.id)}
          onMove={(direction) => move(index, direction)}
          canMoveUp={index > 0 && !reorderBranches.isPending}
          canMoveDown={
            index < branches.length - 1 && !reorderBranches.isPending
          }
        />
      ))}

      {drafting ? (
        <ActionBranchEditor
          actionId={action.id}
          branch={null}
          earlierRules={branches.map(({ variant }) => variant.rule ?? null)}
          activeContractUserIds={activeContractUserIds}
          ruleError={false}
          sources={sources}
          saving={savingId === "draft"}
          onSave={create}
          onDelete={() => setDrafting(false)}
        />
      ) : (
        <BaseButton
          variant={BaseButtonVariant.BlueOutline}
          onClick={() => setDrafting(true)}
          disabled={!action.taskFormId}
        >
          Add branch
        </BaseButton>
      )}

      {rerouteOpen && reroutePreview.data && (
        <RerouteBranchesModal
          actionId={action.id}
          moves={reroutePreview.data}
          branchNames={
            new Map(branches.map(({ variant }) => [variant.id, variant.name]))
          }
          onClose={() => setRerouteOpen(false)}
        />
      )}
    </div>
  );
}
