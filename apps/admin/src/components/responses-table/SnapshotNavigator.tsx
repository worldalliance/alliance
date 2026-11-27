import { useResponseSnapshotMigrationsAdmin } from "@alliance/shared/lib/useResponseSnapshotMigrationAdmin";
import { GitCompare } from "lucide-react";
import React, { useMemo, useState } from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { formatDate } from "../../lib/formatDate";
import { countOf } from "../../lib/formatNumber";
import { stableStringify } from "../../lib/schemaDiff";
import Badge from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import { Banner, BannerTone } from "../../ui/templates/Banner";
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

const ChangeList: React.FC<{ changes: SnapshotChanges }> = ({ changes }) => {
  if (!hasChanges(changes)) {
    return (
      <p className="text-caption text-fg-muted">
        No question changed in this version.
      </p>
    );
  }
  const lines = [
    ...changes.added.map((label) => ({ verb: "Added", text: label })),
    ...changes.removed.map((label) => ({ verb: "Removed", text: label })),
    ...changes.reworded.map(({ from, to }) => ({
      verb: "Reworded",
      text: `"${from}" to "${to}"`,
    })),
    ...changes.optionsChanged.map((label) => ({
      verb: "Options changed on",
      text: label,
    })),
  ];
  return (
    <ul className="flex flex-col gap-0.5 text-caption">
      {lines.map(({ verb, text }) => (
        <li key={`${verb}-${text}`}>
          <span className="font-semibold">{verb}</span> {text}
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
  /** Goes to the form's Versions tab; null where there is no form to go to. */
  onReassign: (() => void) | null;
};

const SnapshotNavigator: React.FC<SnapshotNavigatorProps> = ({
  open,
  entries,
  fields,
  formIds,
  selectedSnapshotId,
  onSelectVersion,
  onReassign,
}) => {
  const [compared, setCompared] = useState<number[]>([]);

  const {
    migrations,
    isPending: metaPending,
    isError: metaFailed,
  } = useResponseSnapshotMigrationsAdmin(formIds, { enabled: open });

  const snapshotCreatedAt = new Map<number, string>();
  for (const data of migrations) {
    snapshotCreatedAt.set(
      data.latestSnapshot.id,
      data.latestSnapshot.createdAt,
    );
    for (const group of data.groups) {
      snapshotCreatedAt.set(group.snapshot.id, group.snapshot.createdAt);
    }
  }

  const toggleCompared = (snapshotId: number) => {
    setCompared((current) =>
      current.includes(snapshotId)
        ? current.filter((id) => id !== snapshotId)
        : [...current, snapshotId].slice(-2),
    );
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
    <div className="flex flex-col gap-4 p-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-fg-muted">
          {countOf(entries.length, "version")} in these responses. Pick one to
          filter the table, or two to compare.
        </p>
        {onReassign && (
          <Button
            variant={ButtonVariant.Default}
            size="small"
            onClick={onReassign}
          >
            Reassign snapshots
          </Button>
        )}
      </div>

      {metaFailed && (
        <Banner tone={BannerTone.Warning} inline>
          Couldn't load when each version was first saved. Everything else here
          still applies.
        </Banner>
      )}

      {diff && (
        <section
          aria-label={`v${diff.older} compared with v${diff.newer}`}
          className="overflow-hidden rounded-card border border-line"
        >
          <p className="border-b border-line bg-surface-2 px-3 py-2 text-caption font-medium">
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
        </section>
      )}

      <ul className="flex flex-col gap-2">
        {entries.map((entry) => {
          const createdAt = snapshotCreatedAt.get(entry.snapshotId);
          const selected = selectedSnapshotId === entry.snapshotId;
          const isCompared = compared.includes(entry.snapshotId);
          return (
            <li
              key={entry.snapshotId}
              className={cn(
                "rounded-card border bg-surface p-3",
                selected ? "border-accent bg-accent-soft" : "border-line",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    onSelectVersion(selected ? null : entry.snapshotId)
                  }
                  className="flex min-w-0 flex-1 flex-col rounded-sm text-left focus-ring"
                >
                  <span className="flex items-center gap-2">
                    <IdentitySwatch seed={snapshotSeed(entry.snapshotId)} />
                    <span className="font-semibold">v{entry.snapshotId}</span>
                    {entry.isCurrent && <Badge>Current</Badge>}
                  </span>
                  <span className="mt-0.5 text-caption text-fg-muted">
                    {createdAt
                      ? `First saved ${formatDate(createdAt)}`
                      : metaPending && !metaFailed
                        ? "Loading when it was first saved…"
                        : "First saved date unavailable"}
                  </span>
                  <span className="mt-0.5 text-caption text-fg-muted">
                    {entry.responseCount === 0
                      ? "No responses"
                      : `${countOf(entry.responseCount, "response")}${
                          entry.firstResponseAt && entry.lastResponseAt
                            ? ` · ${formatDate(entry.firstResponseAt)} – ${formatDate(entry.lastResponseAt)}`
                            : ""
                        }`}
                  </span>
                </button>
                <Button
                  variant={ButtonVariant.Default}
                  size="small"
                  aria-pressed={isCompared}
                  className="aria-pressed:bg-surface-2"
                  onClick={() => toggleCompared(entry.snapshotId)}
                  aria-label={`Compare v${entry.snapshotId}`}
                >
                  <GitCompare aria-hidden="true" className="size-4" />
                  Compare
                </Button>
              </div>
              {entry.changes && (
                <div className="mt-2 border-t border-line pt-2">
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
