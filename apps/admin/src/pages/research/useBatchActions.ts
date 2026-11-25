import type {
  KoraBatchDto,
  KoraDeletionImpactDto,
} from "@alliance/shared/client";
import { type RefObject, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDateTime } from "../../lib/formatDate";
import { countOf } from "../../lib/formatNumber";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import {
  KoraBatchAction,
  useKoraBatchAction,
  useKoraDeletionImpact,
} from "../../lib/useKoraBatchesAdmin";
import { useToast } from "../../ui/ToastProvider";
import { useFocusAfterRemoval } from "../../ui/useFocusAfterRemoval";
import { isOpen } from "./batchRules";

const DONE: Record<KoraBatchAction, string> = {
  [KoraBatchAction.Retire]: "Batch retired",
  [KoraBatchAction.Reactivate]: "Batch reactivated",
  [KoraBatchAction.Delete]: "Batch deleted",
};

export const batchName = (batch: KoraBatchDto) =>
  `the batch uploaded ${formatDateTime(batch.createdAt)}`;

export const batchRowName = (batch: KoraBatchDto) =>
  `${batchName(batch)}, ${countOf(batch.transcriptCount, "transcript")}`;

// kora-batch-actions.service.ts: retire drops the batch's unrated transcripts
// from unfinished assignments, which are given others in their place.
export const retireMessage = (params: { open: boolean; lastOpen: boolean }) =>
  [
    params.lastOpen &&
      "This is the last batch being assigned, so no chat pairs will be left to assign.",
    params.open
      ? "Its chat pairs stop being assigned to volunteers, and pairs not yet rated leave assignments in progress."
      : "Its pairs not yet rated leave assignments in progress.",
    "Ratings already given stay in the export, marked as from a retired batch.",
    "You can reactivate it later.",
  ]
    .filter(Boolean)
    .join("\n\n");

export const deleteMessage = (impact: KoraDeletionImpactDto) =>
  [
    `This permanently removes ${countOf(impact.transcriptCount, "chat pair")}, ${countOf(impact.ratingCount, "rating")} and ${countOf(impact.assignmentCount, "volunteer assignment")}.`,
    "Pairs not yet rated leave other assignments in progress.",
    "You can't undo this.",
  ].join("\n\n");

/** `fallback` takes focus when the last batch is deleted. */
export function useBatchActions(
  batches: KoraBatchDto[],
  fallback: RefObject<{ focus: () => void } | null>,
) {
  const confirm = useConfirmOnPage();
  const { success } = useToast();
  const [problem, setProblem] = useState<string | null>(null);
  const fail = (error: Error) =>
    setProblem(adminRefusalMessage(error, "Couldn't change the batch."));
  const act = useKoraBatchAction({
    onSuccess: (action) => success(DONE[action]),
    onError: fail,
  });
  const focus = useFocusAfterRemoval({
    ids: batches.map((batch) => batch.id),
    fallback,
  });
  const run = (
    action: KoraBatchAction,
    batch: KoraBatchDto,
    onSuccess?: () => void,
  ) => {
    setProblem(null);
    act.mutate({ action, batchId: batch.id }, { onSuccess });
  };

  const askDelete = async (
    counts: KoraDeletionImpactDto,
    batch: KoraBatchDto,
  ) => {
    const confirmed = await confirm({
      title: `Delete ${batchName(batch)}?`,
      message: deleteMessage(counts),
      confirmLabel: "Delete batch",
      destructive: true,
    });
    if (confirmed) {
      run(KoraBatchAction.Delete, batch, focus.removing(batch.id));
    }
  };

  const impact = useKoraDeletionImpact({
    // The question opens once the counts are in, so the row's Delete stops
    // being busy while it is asked.
    onSuccess: (counts, batch) => void askDelete(counts, batch),
    onError: fail,
  });

  const retire = async (batch: KoraBatchDto) => {
    const now = new Date();
    const open = batches.filter((b) => isOpen(b, now));
    const confirmed = await confirm({
      title: `Retire ${batchName(batch)}?`,
      message: retireMessage({
        open: isOpen(batch, now),
        lastOpen: open.length === 1 && open[0].id === batch.id,
      }),
      confirmLabel: "Retire batch",
    });
    if (confirmed) run(KoraBatchAction.Retire, batch);
  };

  return {
    row: focus.row,
    problem,
    dismiss: () => setProblem(null),
    retire: (batch: KoraBatchDto) => void retire(batch),
    reactivate: (batch: KoraBatchDto) => run(KoraBatchAction.Reactivate, batch),
    remove: (batch: KoraBatchDto) => {
      setProblem(null);
      impact.mutate(batch);
    },
    busyWith: (batch: KoraBatchDto, action: KoraBatchAction) =>
      (act.isPending &&
        act.variables.batchId === batch.id &&
        act.variables.action === action) ||
      (action === KoraBatchAction.Delete &&
        impact.isPending &&
        impact.variables.id === batch.id),
    pendingFor: (batch: KoraBatchDto) =>
      (act.isPending && act.variables.batchId === batch.id) ||
      (impact.isPending && impact.variables.id === batch.id),
  };
}
