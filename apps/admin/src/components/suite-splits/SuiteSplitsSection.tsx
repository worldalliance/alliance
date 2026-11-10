import type { ActionDto } from "@alliance/shared/client";
import type { ParsedSuiteSplit } from "@alliance/shared/parsed-dtos";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import InlineError from "@alliance/sharedweb/ui/InlineError";
import { ToastPlacement, useToast } from "@alliance/sharedweb/ui/ToastProvider";
import { useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { useSuiteSplitsAdmin } from "../../lib/useSuiteSplitsAdmin";
import { useActionEditorLookups } from "../../pages/action-dashboard/useActionEditorLookups";
import CohortExpressionText from "../CohortExpressionText";
import SuiteSplitEditor from "./SuiteSplitEditor";
import { VISIBILITY_MODE_LABELS } from "./splitDraft";

type Editing = { kind: "new" } | { kind: "edit"; splitId: number } | null;

export default function SuiteSplitsSection({
  suiteId,
  suiteActions,
}: {
  suiteId: number;
  suiteActions: ActionDto[];
}) {
  const { splits, save, remove } = useSuiteSplitsAdmin(suiteId);
  const lookups = useActionEditorLookups();
  const { confirm } = useToast();
  const [editing, setEditing] = useState<Editing>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const startEditing = (next: Editing) => {
    save.reset();
    setEditing(next);
  };

  const handleDelete = async (split: ParsedSuiteSplit, button: HTMLElement) => {
    const ok = await confirm({
      message: `Delete the split "${split.title}"? Its actions stay in the suite, keeping the cohort expressions and optional flags the split gave them, which you can then edit on each action.`,
      confirmLabel: "Delete split",
      cancelLabel: "Cancel",
      anchorEl: button,
      placement: ToastPlacement.TopLeft,
    });
    if (!ok) return;
    setDeleteError(null);
    remove.mutate(split.id, {
      onError: (e) =>
        setDeleteError(adminRefusalMessage(e, "Failed to delete the split.")),
    });
  };

  const editor = (split: ParsedSuiteSplit | null) => (
    <SuiteSplitEditor
      split={split}
      suiteActions={suiteActions}
      otherSplits={(splits.data ?? []).filter((other) => other !== split)}
      lookups={lookups}
      saving={save.isPending}
      error={
        save.error
          ? adminRefusalMessage(save.error, "Failed to save the split.")
          : null
      }
      onSave={(body) =>
        save.mutate(
          { splitId: split?.id ?? null, body },
          { onSuccess: () => setEditing(null) },
        )
      }
      onCancel={() => setEditing(null)}
    />
  );

  const actionName = (actionId: number) =>
    suiteActions.find((action) => action.id === actionId)?.name ??
    `Action #${actionId}`;

  return (
    <Card className="!p-0">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 p-3">
        <div>
          <h2 className="text-sm font-semibold">Splits</h2>
          <p className="text-xs text-zinc-500">
            A split gives each member it reaches exactly one of several of this
            suite&apos;s actions, by rule.
          </p>
        </div>
        {editing === null && splits.isSuccess && (
          <Button
            color={ButtonColor.Black}
            onClick={() => startEditing({ kind: "new" })}
          >
            New split
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-4 p-4">
        {splits.isPending ? (
          <p className="text-sm text-zinc-500">Loading splits…</p>
        ) : splits.isError ? (
          <InlineError
            message={adminRefusalMessage(
              splits.error,
              "Failed to load the suite's splits.",
            )}
          />
        ) : (
          <>
            {editing?.kind === "new" && editor(null)}
            {splits.data.length === 0 && editing === null && (
              <p className="text-sm text-zinc-500">
                No splits yet. Every action reaches members by its own cohort
                expression.
              </p>
            )}
            <InlineError message={deleteError} />
            {splits.data.map((split) =>
              editing?.kind === "edit" && editing.splitId === split.id ? (
                <div key={split.id}>{editor(split)}</div>
              ) : (
                <section
                  key={split.id}
                  aria-label={split.title}
                  className="flex flex-col gap-2 rounded border border-gray-2 p-4 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">{split.title}</h3>
                    <div className="flex gap-2">
                      <Button
                        color={ButtonColor.White}
                        size="small"
                        aria-label={`Edit ${split.title}`}
                        onClick={() =>
                          startEditing({ kind: "edit", splitId: split.id })
                        }
                      >
                        Edit
                      </Button>
                      {!split.launched && (
                        <Button
                          color={ButtonColor.White}
                          size="small"
                          aria-label={`Delete ${split.title}`}
                          disabled={remove.isPending}
                          onClick={(e) =>
                            void handleDelete(split, e.currentTarget)
                          }
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-zinc-600">
                    {VISIBILITY_MODE_LABELS[split.visibilityMode].label}{" "}
                    visibility
                    {split.launched && " · Launched"} · Reaches{" "}
                    {split.filterExpression ? (
                      <CohortExpressionText
                        expression={split.filterExpression}
                        tags={lookups.availableTags}
                        actions={lookups.allActions}
                      />
                    ) : (
                      "every member"
                    )}
                  </p>
                  <ol className="list-decimal pl-5">
                    {split.arms.map((arm) => (
                      <li key={arm.id}>
                        {actionName(arm.actionId)}
                        {arm.optional && " (optional)"}:{" "}
                        {arm.rule ? (
                          <CohortExpressionText
                            expression={arm.rule}
                            tags={lookups.availableTags}
                            actions={lookups.allActions}
                          />
                        ) : (
                          "everyone else"
                        )}
                      </li>
                    ))}
                  </ol>
                </section>
              ),
            )}
          </>
        )}
      </div>
    </Card>
  );
}
