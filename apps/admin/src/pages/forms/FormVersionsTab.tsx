import { MIGRATE_RESPONSE_SNAPSHOTS_MAX_BATCH } from "@alliance/common/forms/snapshot-migration";
import type {
  FormSnapshotDto,
  SnapshotResponseGroupDto,
  SnapshotResponseSummaryDto,
} from "@alliance/shared/client";
import { useResponseSnapshotMigrationAdmin } from "@alliance/shared/lib/useResponseSnapshotMigrationAdmin";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatDateTime } from "../../lib/formatDate";
import { countOf, formatCount } from "../../lib/formatNumber";
import { getReturnTo } from "../../lib/navigation";
import { SchemaDiffView } from "../../lib/schemaDiff";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import Button, { ButtonVariant } from "../../ui/Button";
import { Checkbox } from "../../ui/Checkbox";
import { EmptyState } from "../../ui/EmptyState";
import { Skeleton } from "../../ui/Skeleton";
import {
  ExpandToggle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { BulkBar } from "../../ui/templates/List";
import { Panel } from "../../ui/templates/Overview";
import { PageBody } from "../../ui/templates/Page";
import { ContentState, RefreshFailedBanner } from "../../ui/templates/States";
import { useToast } from "../../ui/ToastProvider";

const respondentOf = (response: SnapshotResponseSummaryDto): string => {
  if (response.userName && response.userName.trim()) return response.userName;
  if (response.userId != null) return `User ${response.userId}`;
  return "Anonymous";
};

const versionName = (snapshot: FormSnapshotDto) => `v${snapshot.id}`;

const firstSaved = (snapshot: FormSnapshotDto) =>
  `First saved ${formatDateTime(snapshot.createdAt)}`;

function Hash({ hash }: { hash: string }) {
  return (
    <span className="font-mono text-xs text-fg-muted" title={hash}>
      {hash.slice(0, 12)}…
    </span>
  );
}

/**
 * The form's current version and each older one that still has responses,
 * with the way to point those responses at the current version.
 */
export function FormVersionsTab({ formId }: { formId: number }) {
  const location = useLocation();
  const confirm = useConfirmOnPage();
  const { success } = useToast();
  const returnTo = getReturnTo(location.state, "");

  const { data, migrate, ...query } = useResponseSnapshotMigrationAdmin(formId);

  const [picked, setPicked] = useState<ReadonlySet<number>>(new Set());
  // A reload can take a response off its older version (someone else
  // reassigned it): only responses still listed count as selected.
  const selected = useMemo(() => {
    const listed = new Set(
      data?.groups.flatMap((group) => group.responses.map((r) => r.id)),
    );
    return new Set([...picked].filter((id) => listed.has(id)));
  }, [data, picked]);
  const clearSelection = useCallback(() => setPicked(new Set()), []);

  const setResponses = (ids: readonly number[], select: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (select) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const [reassignError, setReassignError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reassignError) errorRef.current?.scrollIntoView({ block: "nearest" });
  }, [reassignError]);

  const total =
    data?.groups.reduce((sum, group) => sum + group.responses.length, 0) ?? 0;
  const tooMany = selected.size > MIGRATE_RESPONSE_SNAPSHOTS_MAX_BATCH;

  const reassign = async () => {
    if (!data || selected.size === 0 || tooMany) return;
    const responses = countOf(selected.size, "response");
    const confirmed = await confirm({
      title: `Reassign ${responses} to the current version?`,
      message:
        "Their answers are stored unchanged. An answer to a question the current version no longer has stays stored but belongs to no question, and a question the current version added or made required stays blank.\n\nThe server reassigns only to the current version, so the admin can't move them back. Members who look back at these responses see them under the current version's questions. No one is notified.",
      confirmLabel: `Reassign ${responses}`,
      destructive: true,
    });
    if (!confirmed) return;
    setReassignError(null);
    migrate.mutate(
      {
        responseIds: [...selected],
        targetSnapshotId: data.latestSnapshot.id,
      },
      {
        onSuccess: (updated) => {
          success(`Reassigned ${countOf(updated, "response")}.`);
          clearSelection();
        },
        onError: (error) => {
          const reason = adminRefusalMessage(error, "");
          setReassignError(
            reason
              ? `Couldn't reassign the responses: ${reason}`
              : "Couldn't reassign the responses.",
          );
        },
      },
    );
  };

  return (
    <>
      <div ref={errorRef}>
        <RefreshFailedBanner things="versions" query={query} />
        {reassignError && (
          <Banner
            tone={BannerTone.Danger}
            action={
              <Button
                size="small"
                variant={ButtonVariant.Ghost}
                onClick={() => setReassignError(null)}
              >
                Dismiss
              </Button>
            }
          >
            {reassignError}
          </Banner>
        )}
      </div>
      <PageBody>
        <div className="flex items-start justify-between gap-section">
          <p className="max-w-prose text-fg-muted">
            A save that changes the form's content, its wording included, moves
            it to the version with that content, which another form with
            identical content may share, and a response stays on the version it
            was submitted to. Reassigning points a response at the current
            version without changing its answers: an answer to a question the
            current version no longer has stays stored but belongs to no
            question, and a question the current version added or made required
            stays blank. Compare a version with the current one before
            reassigning its responses. One request reassigns up to{" "}
            {formatCount(MIGRATE_RESPONSE_SNAPSHOTS_MAX_BATCH)} responses.
          </p>
          {returnTo && (
            <Button
              variant={ButtonVariant.Default}
              to={returnTo}
              className="shrink-0"
            >
              Back to responses
            </Button>
          )}
        </div>
        <ContentState
          things="versions"
          query={query}
          refreshBanner={false}
          skeleton={
            <>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-64 w-full" />
            </>
          }
        >
          {data && (
            <>
              <Panel
                title="Current version"
                description={`${versionName(data.latestSnapshot)} · ${firstSaved(data.latestSnapshot)}`}
                action={<Hash hash={data.latestSnapshot.hash} />}
              >
                {data.groups.length === 0 ? (
                  <EmptyState
                    title="Every response is on the current version"
                    description="There is nothing to reassign."
                  />
                ) : (
                  <p>
                    {countOf(total, "response")} on{" "}
                    {countOf(data.groups.length, "older version")} can be
                    reassigned to it.
                  </p>
                )}
              </Panel>
              {data.groups.map((group) => (
                <OlderVersionPanel
                  key={group.snapshot.id}
                  group={group}
                  latestSnapshot={data.latestSnapshot}
                  selected={selected}
                  onSet={setResponses}
                />
              ))}
            </>
          )}
        </ContentState>
      </PageBody>
      <BulkBar count={selected.size} onClear={clearSelection}>
        <Button
          variant={ButtonVariant.Primary}
          size="small"
          disabled={tooMany}
          busy={migrate.isPending}
          onClick={() => void reassign()}
        >
          {tooMany
            ? `Too many selected (max ${formatCount(MIGRATE_RESPONSE_SNAPSHOTS_MAX_BATCH)})`
            : "Reassign to current version…"}
        </Button>
      </BulkBar>
    </>
  );
}

function OlderVersionPanel({
  group,
  latestSnapshot,
  selected,
  onSet,
}: {
  group: SnapshotResponseGroupDto;
  latestSnapshot: FormSnapshotDto;
  selected: ReadonlySet<number>;
  onSet: (ids: readonly number[], select: boolean) => void;
}) {
  const listId = useId();
  const allId = useId();
  const [open, setOpen] = useState(false);
  const ids = useMemo(
    () => group.responses.map((response) => response.id),
    [group.responses],
  );
  const selectedHere = ids.filter((id) => selected.has(id)).length;
  const all = selectedHere === ids.length;
  const allRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (allRef.current) {
      allRef.current.indeterminate = selectedHere > 0 && !all;
    }
  }, [selectedHere, all]);
  const name = versionName(group.snapshot);

  return (
    <Panel
      title={`Older version ${name}`}
      description={firstSaved(group.snapshot)}
      action={<Hash hash={group.snapshot.hash} />}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label htmlFor={allId} className="flex items-center gap-2">
            <Checkbox
              id={allId}
              ref={allRef}
              checked={all}
              onChange={(event) => onSet(ids, event.target.checked)}
            />
            <span className="font-medium">
              Select all {countOf(ids.length, "response")} on {name}
            </span>
          </label>
          <span className="text-fg-muted tabular-nums" aria-live="polite">
            {formatCount(selectedHere)} selected
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-caption font-medium text-fg-muted">
            Changes from {name} to the current version (
            {versionName(latestSnapshot)})
          </h3>
          <SchemaDiffView
            before={group.snapshot.schema}
            after={latestSnapshot.schema}
          />
        </div>
        <div className="flex flex-col gap-2">
          <div>
            <ExpandToggle
              expanded={open}
              controls={listId}
              onToggle={() => setOpen((value) => !value)}
              aria-label={`${countOf(ids.length, "response")} on ${name}`}
            >
              {countOf(ids.length, "response")}
            </ExpandToggle>
          </div>
          {open && (
            <div
              id={listId}
              className="max-h-80 overflow-auto rounded-md border border-line"
            >
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <span className="sr-only">Select</span>
                    </TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead>Respondent</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.responses.map((response) => {
                    const checked = selected.has(response.id);
                    return (
                      <TableRow key={response.id} aria-selected={checked}>
                        <TableCell className="w-0">
                          <Checkbox
                            aria-label={`Select response ${response.id}, ${respondentOf(response)}`}
                            checked={checked}
                            onChange={(event) =>
                              onSet([response.id], event.target.checked)
                            }
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs text-fg-muted">
                          {response.id}
                        </TableCell>
                        <TableCell truncate>{respondentOf(response)}</TableCell>
                        <TableCell>
                          {formatDateTime(response.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
