import type { ActionUpdateDto } from "@alliance/shared/client";
import {
  actionUpdateStatus,
  ActionUpdateStatus,
} from "../../lib/actionUpdateStatus";
import { BadgeTone } from "../../ui/Badge";

/** The order the list groups them in. */
const STATUS_ORDER = [
  ActionUpdateStatus.Draft,
  ActionUpdateStatus.Scheduled,
  ActionUpdateStatus.Published,
] as const;

export const STATUS_TONE: Record<ActionUpdateStatus, BadgeTone> = {
  [ActionUpdateStatus.Draft]: BadgeTone.Neutral,
  [ActionUpdateStatus.Scheduled]: BadgeTone.Info,
  [ActionUpdateStatus.Published]: BadgeTone.Success,
};

export function groupByStatus(
  updates: readonly ActionUpdateDto[],
  now: Date,
): { status: ActionUpdateStatus; updates: ActionUpdateDto[] }[] {
  return STATUS_ORDER.map((status) => ({
    status,
    updates: updates.filter(
      (update) => actionUpdateStatus(update, now) === status,
    ),
  })).filter((group) => group.updates.length > 0);
}

export const taskNameOf = (update: ActionUpdateDto) =>
  update.actionName ?? `Task #${update.actionId}`;

export const matchesSearch = (update: ActionUpdateDto, q: string) => {
  const needle = q.trim().toLowerCase();
  return (
    update.title.toLowerCase().includes(needle) ||
    taskNameOf(update).toLowerCase().includes(needle)
  );
};
