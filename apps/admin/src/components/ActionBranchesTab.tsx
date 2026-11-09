import { withCount } from "@alliance/common/plural";
import type { ActionBranchesListDto, ActionDto } from "@alliance/shared/client";
import { parseActionBranchDto } from "@alliance/shared/parsed-dtos";
import { CardStyle } from "@alliance/shared/styles/card";
import BaseButton, {
  BaseButtonVariant,
} from "@alliance/sharedweb/ui/BaseButton";
import Card from "@alliance/sharedweb/ui/Card";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useMemo, useState } from "react";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { FormArmKind } from "../lib/formArm";
import { useBranchesAdmin } from "../lib/useBranchesAdmin";
import { useReroutePreviewAdmin } from "../lib/useFormAssignmentsAdmin";
import { useFormVariantsAdmin } from "../lib/useFormVariantsAdmin";
import { useRefusalToast } from "../lib/useRefusalToast";
import ActionBranchEditor, { type BranchFields } from "./ActionBranchEditor";
import ActionFormMembersPanel from "./ActionFormMembersPanel";
import type { CohortLeafEditorSources } from "./CohortLeafEditors";
import RerouteBranchesModal from "./RerouteBranchesModal";

const parseBranches = (list: ActionBranchesListDto) => ({
  branches: list.branches.map(parseActionBranchDto),
  stats: list.stats,
});

const countVariants = (list: { variants: unknown[] }) => list.variants.length;

export default function ActionBranchesTab(props: {
  action: ActionDto;
  sources: CohortLeafEditorSources;
  activeContractUserIds?: Set<number>;
}) {
  const { action, sources, activeContractUserIds } = props;
  const toast = useToast();
  const toastRefusal = useRefusalToast();
  const {
    branches: branchesQuery,
    createBranch,
    updateBranch,
    deleteBranch,
    reorderBranches,
  } = useBranchesAdmin(action.id, parseBranches);
  const { variants: variantCount } = useFormVariantsAdmin(
    action.id,
    countVariants,
  );
  const [drafting, setDrafting] = useState(false);
  const [savingId, setSavingId] = useState<number | "draft" | null>(null);
  const [rerouteOpen, setRerouteOpen] = useState(false);

  const branches = useMemo(
    () => branchesQuery.data?.branches ?? [],
    [branchesQuery.data],
  );
  const statsById = new Map(
    (branchesQuery.data?.stats ?? []).map((s) => [s.branchId, s]),
  );
  const reroutePreview = useReroutePreviewAdmin({
    actionId: action.id,
    enabled: branches.length > 0,
  });
  const pendingMoves = reroutePreview.data?.length ?? 0;
  const hasVariants = (variantCount.data ?? 0) > 0;

  const create = async (fields: BranchFields) => {
    if (!action.taskFormId) return;
    setSavingId("draft");
    try {
      await createBranch.mutateAsync({
        ...fields,
        sourceFormId: action.taskFormId,
      });
      setDrafting(false);
      toast.success(`Created "${fields.name}"`);
    } catch (error) {
      toastRefusal(error, "Failed to create the branch");
    } finally {
      setSavingId(null);
    }
  };

  const save = async (branchId: number, fields: BranchFields) => {
    setSavingId(branchId);
    try {
      await updateBranch.mutateAsync({ branchId, body: fields });
      toast.success(`Saved "${fields.name}"`);
    } catch (error) {
      toastRefusal(error, "Failed to save the branch");
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (branchId: number) => {
    if (
      !window.confirm(
        "Delete this branch? Before launch, this also removes members' routing to it. After launch, it's blocked if any members are on it.",
      )
    ) {
      return;
    }
    try {
      await deleteBranch.mutateAsync(branchId);
    } catch (error) {
      toastRefusal(error, "Failed to delete the branch");
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const ids = branches.map(({ branch }) => branch.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    try {
      await reorderBranches.mutateAsync(ids);
    } catch (error) {
      toastRefusal(error, "Failed to reorder the branches");
    }
  };

  if (branchesQuery.isPending || variantCount.isPending) {
    return <div className="text-zinc-500">Loading branches…</div>;
  }
  if (branchesQuery.isError || variantCount.isError) {
    return (
      <div className="text-red-500">
        {adminRefusalMessage(
          branchesQuery.error ?? variantCount.error,
          "Failed to load branches.",
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Branches</h2>
        <p className="text-sm text-zinc-600 max-w-2xl">
          Each member of the action&apos;s cohort is routed once, when their
          cohort decision is made, to the first branch whose rule they match,
          and sees that branch&apos;s form and copy. Members matching no branch
          aren&apos;t assigned the action.
        </p>
      </div>

      {hasVariants && (
        <Card style={CardStyle.Alert} className="p-4 text-sm">
          This action splits members into random variants on the Form Variants
          tab, so it can&apos;t also route them by branch rules. Delete its
          variants there to add branches.
        </Card>
      )}
      {action.publicOnly && (
        <Card style={CardStyle.Alert} className="p-4 text-sm">
          A public-only action makes no cohort decisions, so it can&apos;t route
          members to branches.
        </Card>
      )}
      {!action.taskFormId && (
        <Card style={CardStyle.Alert} className="p-4 text-sm">
          Set the action&apos;s task form (in the &quot;Task Form&quot; tab)
          before adding branches. Each branch starts as a copy of it.
        </Card>
      )}

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

      {branches.map(({ branch, ruleError }, index) => {
        const stats = statsById.get(branch.id);
        return (
          <div key={`${branch.id}:${branch.updatedAt}`} className="space-y-1">
            {stats && (
              <p className="text-xs text-zinc-500">
                {withCount(stats.assigned, "member")} on this branch,{" "}
                {stats.submitted} submitted
              </p>
            )}
            <ActionBranchEditor
              actionId={action.id}
              branch={branch}
              position={index + 1}
              earlierRules={branches
                .slice(0, index)
                .map(({ branch: earlier }) => earlier.rule)}
              activeContractUserIds={activeContractUserIds}
              ruleError={ruleError !== null}
              sources={sources}
              saving={savingId === branch.id}
              onSave={(fields) => save(branch.id, fields)}
              onDelete={() => remove(branch.id)}
              onMove={(direction) => move(index, direction)}
              canMoveUp={index > 0 && !reorderBranches.isPending}
              canMoveDown={
                index < branches.length - 1 && !reorderBranches.isPending
              }
            />
          </div>
        );
      })}

      {drafting ? (
        <ActionBranchEditor
          actionId={action.id}
          branch={null}
          position={branches.length + 1}
          earlierRules={branches.map(({ branch }) => branch.rule)}
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
          disabled={!action.taskFormId || hasVariants || action.publicOnly}
        >
          Add branch
        </BaseButton>
      )}

      {branches.length > 0 && (
        <Card style={CardStyle.White} className="p-4">
          <ActionFormMembersPanel
            actionId={action.id}
            kind={FormArmKind.Branch}
            arms={branches.map(({ branch }) => branch)}
            defaultLabel={null}
          />
        </Card>
      )}

      {rerouteOpen && reroutePreview.data && (
        <RerouteBranchesModal
          actionId={action.id}
          moves={reroutePreview.data}
          branchNames={
            new Map(branches.map(({ branch }) => [branch.id, branch.name]))
          }
          onClose={() => setRerouteOpen(false)}
        />
      )}
    </div>
  );
}
