import type {
  KoraBatchDto,
  KoraDeletionImpactDto,
} from "@alliance/shared/client";
import { isProduction } from "@alliance/sharedweb/lib/config";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useState, type ReactNode } from "react";
import { adminRefusalMessage } from "../lib/adminRefusal";
import { formatKoraDate } from "../lib/koraParticipants";
import {
  KoraBatchAction,
  useKoraBatchAction,
  useKoraDeletionImpact,
} from "../lib/useKoraBatchesAdmin";
import ConfirmDialog from "./ConfirmDialog";

type Pending =
  | { action: KoraBatchAction.Retire; batch: KoraBatchDto }
  | {
      action: KoraBatchAction.Delete;
      batch: KoraBatchDto;
      impact: KoraDeletionImpactDto;
    };

const DONE: Record<KoraBatchAction, string> = {
  [KoraBatchAction.Retire]: "Batch retired",
  [KoraBatchAction.Reactivate]: "Batch reactivated",
  [KoraBatchAction.Delete]: "Batch deleted",
};

export const countOf = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

function retireMessage(params: { lastAssigned: boolean }): string {
  return [
    params.lastAssigned &&
      "This is the last batch being assigned, so no chat pairs will be left to assign.",
    "Its chat pairs stop being assigned to volunteers, and pairs not yet rated leave assignments in progress.",
    "Ratings already given stay in the export, marked as from a retired batch.",
    "You can reactivate it later.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function deleteMessage(impact: KoraDeletionImpactDto): string {
  return [
    `This permanently removes ${countOf(impact.transcriptCount, "chat pair", "chat pairs")}, ${countOf(impact.ratingCount, "rating", "ratings")} and ${countOf(impact.assignmentCount, "volunteer assignment", "volunteer assignments")}.`,
    "Pairs not yet rated leave other assignments in progress.",
    "You can't undo this.",
  ].join("\n\n");
}

function dialogCopy(params: { pending: Pending; assigned: KoraBatchDto[] }): {
  title: string;
  message: string;
  confirmLabel: string;
  destructive: boolean;
} {
  const { pending, assigned } = params;
  const uploaded = formatKoraDate(pending.batch.createdAt);
  switch (pending.action) {
    case KoraBatchAction.Retire:
      return {
        title: `Retire the batch uploaded ${uploaded}?`,
        message: retireMessage({
          lastAssigned:
            assigned.length === 1 && assigned[0].id === pending.batch.id,
        }),
        confirmLabel: "Retire batch",
        destructive: false,
      };
    case KoraBatchAction.Delete:
      return {
        title: `Delete the batch uploaded ${uploaded}?`,
        message: deleteMessage(pending.impact),
        confirmLabel: "Delete batch",
        destructive: true,
      };
    default:
      throw new Error(`unknown action: ${pending satisfies never}`);
  }
}

export function useKoraBatchActions(batches: KoraBatchDto[]): {
  actionsFor: (batch: KoraBatchDto) => ReactNode;
  dialog: ReactNode;
} {
  const toast = useToast();
  const [pending, setPending] = useState<Pending | null>(null);
  const onError = (error: Error) => {
    toast.error(
      adminRefusalMessage(error, "Couldn't change the batch. Try again."),
    );
    setPending(null);
  };
  const act = useKoraBatchAction({
    onSuccess: (action) => {
      toast.success(DONE[action]);
      setPending(null);
    },
    onError,
  });
  const impact = useKoraDeletionImpact({
    onSuccess: (counts, batch) =>
      setPending({ action: KoraBatchAction.Delete, batch, impact: counts }),
    onError,
  });
  const assigned = batches.filter((b) => !b.retiredAt);
  const busyWith = (batch: KoraBatchDto) =>
    (act.isPending && act.variables.batchId === batch.id) ||
    (impact.isPending && impact.variables.id === batch.id);

  const actionsFor = (batch: KoraBatchDto) => (
    <div className="flex gap-2">
      {batch.retiredAt ? (
        <Button
          color={ButtonColor.White}
          size="small"
          disabled={busyWith(batch)}
          onClick={() =>
            act.mutate({
              action: KoraBatchAction.Reactivate,
              batchId: batch.id,
            })
          }
        >
          Reactivate
        </Button>
      ) : (
        <Button
          color={ButtonColor.White}
          size="small"
          disabled={busyWith(batch)}
          onClick={() => setPending({ action: KoraBatchAction.Retire, batch })}
        >
          Retire
        </Button>
      )}
      {!isProduction() && (
        <Button
          color={ButtonColor.RedOutline}
          size="small"
          disabled={busyWith(batch)}
          onClick={() => impact.mutate(batch)}
        >
          {impact.isPending && impact.variables.id === batch.id
            ? "Counting…"
            : "Delete"}
        </Button>
      )}
    </div>
  );

  const copy = pending && dialogCopy({ pending, assigned });
  const dialog = (
    <ConfirmDialog
      isOpen={pending !== null}
      title={copy?.title ?? ""}
      message={copy?.message ?? ""}
      confirmLabel={copy?.confirmLabel}
      destructive={copy?.destructive}
      isLoading={act.isPending}
      onConfirm={() =>
        pending &&
        act.mutate({ action: pending.action, batchId: pending.batch.id })
      }
      onCancel={() => setPending(null)}
    />
  );

  return { actionsFor, dialog };
}
