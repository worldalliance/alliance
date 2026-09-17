import { withCount } from "@alliance/common/plural";
import { tasksGetResponseSnapshotMigrationAdmin } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { useQueries } from "@tanstack/react-query";
import { GitCompare } from "lucide-react";
import React, { useMemo, useState } from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { Link } from "react-router";
import { stableStringify } from "../../lib/schemaDiff";
import { IdentitySwatch } from "../IdentitySwatch";
import type { SnapshotFieldSet } from "./columns";
import {
  hasChanges,
  normalizeSnapshotFields,
  type SnapshotChanges,
  type SnapshotEntry,
} from "./snapshots";

export const snapshotSeed = (snapshotId: number): string =>
  `snapshot-${snapshotId}`;

const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const ChangeList: React.FC<{ changes: SnapshotChanges }> = ({ changes }) => {
  if (!hasChanges(changes)) {
    return (
      <p className="text-xs text-zinc-400 italic">
        No question changed in this version.
      </p>
    );
  }
  return (
    <ul className="space-y-0.5 text-xs">
      {changes.added.map((label) => (
        <li key={`added-${label}`} className="text-emerald-700">
          Added {label}
        </li>
      ))}
      {changes.removed.map((label) => (
        <li key={`removed-${label}`} className="text-red-700">
          Removed {label}
        </li>
      ))}
      {changes.reworded.map(({ from, to }) => (
        <li key={`reworded-${from}-${to}`} className="text-amber-700">
          Reworded &quot;{from}&quot; to &quot;{to}&quot;
        </li>
      ))}
      {changes.optionsChanged.map((label) => (
        <li key={`options-${label}`} className="text-sky-700">
          Options changed on {label}
        </li>
      ))}
    </ul>
  );
};

export type SnapshotNavigatorProps = {
  open: boolean;
  entries: readonly SnapshotEntry[];
  fields: SnapshotFieldSet;
  /** Forms whose snapshots appear here. One, unless variants are merged. */
  formIds: readonly number[];
  selectedSnapshotId: number | null;
  onSelectVersion: (snapshotId: number | null) => void;
  snapshotsHref: string | null;
};

const SnapshotNavigator: React.FC<SnapshotNavigatorProps> = ({
  open,
  entries,
  fields,
  formIds,
  selectedSnapshotId,
  onSelectVersion,
  snapshotsHref,
}) => {
  const [compared, setCompared] = useState<number[]>([]);

  const metaQueries = useQueries({
    queries: formIds.map((formId) => ({
      queryKey: ["tasksGetResponseSnapshotMigrationAdmin", formId],
      queryFn: async () => {
        const result = await tasksGetResponseSnapshotMigrationAdmin({
          path: { formId },
        });
        return result.data ?? null;
      },
      enabled: open,
      staleTime: 60_000,
    })),
  });

  const snapshotCreatedAt = new Map<number, string>();
  for (const query of metaQueries) {
    const data = query.data;
    if (!data) continue;
    snapshotCreatedAt.set(
      data.latestSnapshot.id,
      data.latestSnapshot.createdAt,
    );
    for (const group of data.groups) {
      snapshotCreatedAt.set(group.snapshot.id, group.snapshot.createdAt);
    }
  }

  const metaPending = metaQueries.some((query) => query.isPending);
  const metaFailed = metaQueries.some((query) => query.isError);

  const toggleCompared = (snapshotId: number) => {
    setCompared((current) => {
      if (current.includes(snapshotId)) {
        return current.filter((id) => id !== snapshotId);
      }
      return [...current, snapshotId].slice(-2);
    });
  };

  const diff = useMemo(() => {
    if (compared.length !== 2) return null;
    const [older, newer] = [...compared].sort((a, b) => a - b);
    return {
      older,
      newer,
      before: stableStringify(
        normalizeSnapshotFields(fields.bySnapshotId.get(older) ?? []),
      ),
      after: stableStringify(
        normalizeSnapshotFields(fields.bySnapshotId.get(newer) ?? []),
      ),
    };
  }, [compared, fields]);

  return (
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-500">
          {withCount(entries.length, "version")} in these responses. Pick two to
          compare.
        </p>
        {snapshotsHref && (
          <Link
            to={snapshotsHref}
            className="text-sm text-blue-600 hover:underline"
          >
            Reassign snapshots
          </Link>
        )}
      </div>

      {metaFailed && (
        <p className="text-sm text-amber-700">
          Could not load version dates. Everything else below still applies.
        </p>
      )}

      {diff && (
        <div className="overflow-hidden rounded-lg border border-zinc-200">
          <p className="border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-600">
            v{diff.older} → v{diff.newer}
          </p>
          <div className="max-h-96 overflow-auto text-xs">
            <ReactDiffViewer
              oldValue={diff.before}
              newValue={diff.after}
              splitView
              compareMethod={DiffMethod.WORDS_WITH_SPACE}
              showDiffOnly
              extraLinesSurroundingDiff={2}
            />
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {entries.map((entry) => {
          const createdAt = snapshotCreatedAt.get(entry.snapshotId);
          const isSelected = selectedSnapshotId === entry.snapshotId;
          return (
            <li
              key={entry.snapshotId}
              className={cn(
                "rounded-lg border p-3",
                isSelected
                  ? "border-blue-400 bg-blue-50"
                  : "border-zinc-200 bg-white",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() =>
                    onSelectVersion(isSelected ? null : entry.snapshotId)
                  }
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex items-center gap-2">
                    <IdentitySwatch seed={snapshotSeed(entry.snapshotId)} />
                    <span className="font-semibold text-zinc-900">
                      v{entry.snapshotId}
                    </span>
                    {entry.isCurrent && (
                      <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
                        Current
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    {createdAt
                      ? `Created ${formatDate(createdAt)}`
                      : metaPending
                        ? "Loading creation date…"
                        : "Creation date unavailable"}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-600">
                    {entry.responseCount === 0
                      ? "No responses"
                      : `${withCount(entry.responseCount, "response")}${
                          entry.firstResponseAt && entry.lastResponseAt
                            ? ` · ${formatDate(entry.firstResponseAt)} – ${formatDate(entry.lastResponseAt)}`
                            : ""
                        }`}
                  </span>
                </button>
                <Button
                  size="small"
                  color={
                    compared.includes(entry.snapshotId)
                      ? ButtonColor.Black
                      : ButtonColor.White
                  }
                  onClick={() => toggleCompared(entry.snapshotId)}
                  aria-label={`Compare v${entry.snapshotId}`}
                  title={`Compare v${entry.snapshotId}`}
                >
                  <GitCompare aria-hidden="true" className="size-4" />
                </Button>
              </div>
              {entry.changes && (
                <div className="mt-2 border-t border-zinc-100 pt-2">
                  <ChangeList changes={entry.changes} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default SnapshotNavigator;
