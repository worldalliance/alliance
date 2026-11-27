import { R } from "@alliance/common/result";
import type { ActionUpdateDto } from "@alliance/shared/client";
import { useEffect, useRef, useState } from "react";
import { adminRefusalMessage } from "../../../lib/adminRefusal";
import { useActionUpdateAdmin } from "../../../lib/useActionUpdateAdmin";
import { useConfirmOnPage } from "../../../lib/useConfirmOnPage";
import ActionUpdateCard from "../../../ui/ActionUpdateCard";
import Badge from "../../../ui/Badge";
import Button, { ButtonVariant } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { Panel } from "../../../ui/templates/Overview";
import {
  notificationFactOf,
  pacific,
  VISIBILITY_BADGE,
  visibilityOf,
} from "./updateRules";

export function UpdateList({
  actionId,
  updates,
  setError,
  focusAfterLast,
}: {
  actionId: number;
  updates: ActionUpdateDto[];
  setError: (message: string | null) => void;
  /** Where focus goes when the last update left deletes itself. */
  focusAfterLast: () => void;
}) {
  const { remove } = useActionUpdateAdmin(null);
  const confirm = useConfirmOnPage();
  const [deletingIds, setDeletingIds] = useState<ReadonlySet<number>>(
    new Set(),
  );
  const listRef = useRef<HTMLUListElement>(null);
  const [focusNext, setFocusNext] = useState<{
    after: number;
    candidates: number[];
  } | null>(null);

  useEffect(() => {
    if (!focusNext || updates.some((u) => u.id === focusNext.after)) return;
    const target = focusNext.candidates
      .map((id) =>
        listRef.current?.querySelector<HTMLElement>(`[data-update="${id}"] a`),
      )
      .find(Boolean);
    if (target) target.focus();
    else focusAfterLast();
    setFocusNext(null);
  }, [updates, focusNext, focusAfterLast]);

  const handleDelete = async (update: ActionUpdateDto) => {
    const ok = await confirm({
      title: `Delete the project update “${update.title}”?`,
      message: "Members stop seeing it.",
      confirmLabel: "Delete update",
      cancelLabel: "Cancel",
      destructive: true,
    });
    if (!ok) return;
    setError(null);
    setDeletingIds((ids) => new Set(ids).add(update.id));
    const index = updates.findIndex((u) => u.id === update.id);
    const deleted = await R.fromPromise(remove.mutateAsync(update), (thrown) =>
      adminRefusalMessage(thrown, "Couldn't delete the project update."),
    );
    setDeletingIds((ids) => {
      const next = new Set(ids);
      next.delete(update.id);
      return next;
    });
    if (!deleted.ok) {
      setError(deleted.error);
      return;
    }
    setFocusNext({
      after: update.id,
      candidates: [
        ...updates.slice(index + 1),
        ...updates.slice(0, index).reverse(),
      ].map((u) => u.id),
    });
  };

  return (
    <Panel title="Project updates">
      {updates.length === 0 ? (
        <EmptyState
          title="No project updates yet"
          description="Updates you create below show here, as members see them."
        />
      ) : (
        <ul ref={listRef} className="flex flex-col gap-section">
          {updates.map((update) => {
            const visibility =
              VISIBILITY_BADGE[visibilityOf(update, new Date()).state];
            const deleting = deletingIds.has(update.id);
            return (
              <li
                key={update.id}
                data-update={update.id}
                className="overflow-hidden rounded-card border border-line"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface-2 px-4 py-2">
                  <Badge tone={visibility.tone}>{visibility.label}</Badge>
                  <span className="text-fg-muted">
                    Dated {pacific(update.date)} ·{" "}
                    {notificationFactOf(update, new Date())}
                  </span>
                  <div className="ml-auto flex items-center gap-2">
                    <Button
                      size="small"
                      variant={ButtonVariant.Default}
                      to={`/tasks/${actionId}/updates/${update.id}`}
                      aria-label={`Edit: ${update.title}`}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      variant={ButtonVariant.Ghost}
                      busy={deleting}
                      onClick={() => void handleDelete(update)}
                      aria-label={`Delete: ${update.title}`}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <div className="member-surface">
                  <ActionUpdateCard
                    update={update}
                    marksNotificationsRead={false}
                    staffView
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
