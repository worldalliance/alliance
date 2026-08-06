import { MIGRATE_RESPONSE_SNAPSHOTS_MAX_BATCH } from "@alliance/common/forms/snapshot-migration";
import {
  tasksGetResponseSnapshotMigrationAdmin,
  tasksMigrateResponseSnapshotsAdmin,
  type FormSnapshotDto,
  type SnapshotResponseGroupDto,
  type SnapshotResponseSummaryDto,
} from "@alliance/shared/client";
import { CardStyle } from "@alliance/shared/styles/card";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import Card from "@alliance/sharedweb/ui/Card";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { getReturnTo } from "../lib/navigation";
import { SchemaDiffView } from "../lib/schemaDiff";

const formatRespondent = (response: SnapshotResponseSummaryDto): string => {
  if (response.userName && response.userName.trim()) return response.userName;
  if (response.userId != null) return `user #${response.userId}`;
  return "anonymous";
};

const SnapshotGroupCard: React.FC<{
  group: SnapshotResponseGroupDto;
  latestSnapshot: FormSnapshotDto;
  selectedIds: Set<number>;
  onToggleResponse: (responseId: number) => void;
  onToggleGroup: (group: SnapshotResponseGroupDto, select: boolean) => void;
}> = ({
  group,
  latestSnapshot,
  selectedIds,
  onToggleResponse,
  onToggleGroup,
}) => {
  const [showResponses, setShowResponses] = useState(false);
  const groupResponseIds = group.responses.map((r) => r.id);
  const selectedInGroup = groupResponseIds.filter((id) =>
    selectedIds.has(id),
  ).length;
  const allSelected = selectedInGroup === groupResponseIds.length;
  const noneSelected = selectedInGroup === 0;
  const groupCheckboxRef = React.useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (groupCheckboxRef.current) {
      groupCheckboxRef.current.indeterminate = !allSelected && !noneSelected;
    }
  }, [allSelected, noneSelected]);

  return (
    <Card style={CardStyle.White}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <input
              ref={groupCheckboxRef}
              type="checkbox"
              checked={allSelected}
              onChange={(e) => onToggleGroup(group, e.target.checked)}
              className="mt-1"
            />
            <div>
              <h3 className="font-semibold text-sm">
                Snapshot #{group.snapshot.id}
              </h3>
              <p className="text-xs text-zinc-500">
                Created {new Date(group.snapshot.createdAt).toLocaleString()} ·{" "}
                {group.responses.length} response
                {group.responses.length === 1 ? "" : "s"} · {selectedInGroup}{" "}
                selected
              </p>
              <p
                className="text-xs text-zinc-400 font-mono"
                title={group.snapshot.hash}
              >
                {group.snapshot.hash.slice(0, 12)}…
              </p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-wide text-zinc-600 uppercase mb-1">
            Diff vs latest (#{latestSnapshot.id})
          </p>
          <SchemaDiffView
            before={group.snapshot.schema}
            after={latestSnapshot.schema}
          />
        </div>

        <div>
          <button
            type="button"
            className="text-xs text-blue-600 hover:underline"
            onClick={() => setShowResponses((v) => !v)}
          >
            {showResponses ? "Hide responses" : "Show responses"}
          </button>
          {showResponses && (
            <ul className="mt-2 space-y-1 max-h-64 overflow-auto rounded border border-zinc-200 p-2">
              {group.responses.map((response) => (
                <li
                  key={response.id}
                  className="flex items-center gap-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(response.id)}
                    onChange={() => onToggleResponse(response.id)}
                  />
                  <span className="text-zinc-700">#{response.id}</span>
                  <span className="text-zinc-500">
                    {formatRespondent(response)}
                  </span>
                  <span className="text-zinc-400 text-xs ml-auto">
                    {new Date(response.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
};

const FormSnapshotMigration: React.FC = () => {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const numericFormId = Number(formId);
  const isFormIdValid = !Number.isNaN(numericFormId);

  const returnTo = useMemo(
    () => getReturnTo(location.state, `/forms/${numericFormId}/responses`),
    [location.state, numericFormId],
  );

  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => ["tasksGetResponseSnapshotMigrationAdmin", numericFormId] as const,
    [numericFormId],
  );

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isError: isLoadError,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await tasksGetResponseSnapshotMigrationAdmin({
        path: { formId: numericFormId },
      });
      return res.data ?? null;
    },
    enabled: isFormIdValid,
  });

  const migrateMutation = useMutation({
    mutationFn: async () => {
      if (!data) throw new Error("Migration data not loaded");
      const res = await tasksMigrateResponseSnapshotsAdmin({
        path: { formId: numericFormId },
        body: {
          responseIds: Array.from(selectedIds),
          targetSnapshotId: data.latestSnapshot.id,
        },
      });
      return res.data?.updatedCount ?? 0;
    },
    onSuccess: async (updated) => {
      setResultMessage(
        `Reassigned ${updated} response${updated === 1 ? "" : "s"}.`,
      );
      setSelectedIds(new Set());
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const toggleResponse = useCallback((responseId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(responseId)) next.delete(responseId);
      else next.add(responseId);
      return next;
    });
  }, []);

  const toggleGroup = useCallback(
    (group: SnapshotResponseGroupDto, select: boolean) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const r of group.responses) {
          if (select) next.add(r.id);
          else next.delete(r.id);
        }
        return next;
      });
    },
    [],
  );

  const totalResponses = useMemo(
    () => data?.groups.reduce((sum, g) => sum + g.responses.length, 0) ?? 0,
    [data],
  );

  const handleSubmit = useCallback(() => {
    if (selectedIds.size === 0 || !data) return;
    if (
      !confirm(
        `Reassign ${selectedIds.size} response${
          selectedIds.size === 1 ? "" : "s"
        } to the current snapshot? Answer data will not be transformed — keys for removed fields will be orphaned.`,
      )
    ) {
      return;
    }
    setResultMessage(null);
    migrateMutation.mutate();
  }, [selectedIds, data, migrateMutation]);

  const submitting = migrateMutation.isPending;
  const errorMessage = isLoadError
    ? "Failed to load snapshot migration data"
    : migrateMutation.isError
      ? "Failed to reassign snapshots"
      : null;

  return (
    <div className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            Reassign snapshot pointer
            {data?.formTitle ? `: ${data.formTitle}` : ""}
          </h1>
          <p className="text-sm text-zinc-500">
            Repoints existing responses at the form&apos;s current schema
            snapshot. Answer data is <strong>not</strong> transformed — keys for
            fields removed in the new snapshot will be orphaned, and newly
            required fields will be left blank. Review the diff for each group
            before reassigning. Up to {MIGRATE_RESPONSE_SNAPSHOTS_MAX_BATCH}{" "}
            responses can be reassigned per request.
          </p>
        </div>
        <Button
          color={ButtonColor.White}
          size="small"
          onClick={() => navigate(returnTo)}
        >
          Back to responses
        </Button>
      </div>

      {isLoading ? (
        <p>Loading…</p>
      ) : errorMessage ? (
        <p className="text-red-500">{errorMessage}</p>
      ) : !data ? (
        <p className="text-zinc-500">No data.</p>
      ) : (
        <>
          <Card style={CardStyle.White}>
            <div className="text-sm">
              <p>
                <span className="font-semibold">Current snapshot:</span> #
                {data.latestSnapshot.id} (
                {new Date(data.latestSnapshot.createdAt).toLocaleString()})
              </p>
              <p
                className="text-xs text-zinc-500 font-mono"
                title={data.latestSnapshot.hash}
              >
                {data.latestSnapshot.hash.slice(0, 12)}…
              </p>
            </div>
          </Card>

          {data.groups.length === 0 ? (
            <Card style={CardStyle.White}>
              <p className="text-zinc-600">
                All responses are already on the current snapshot.
              </p>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between sticky top-0 bg-gray-50 py-2 z-10">
                <p className="text-sm text-zinc-700">
                  {selectedIds.size} of {totalResponses} responses selected
                  across {data.groups.length} snapshot
                  {data.groups.length === 1 ? "" : "s"}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    color={ButtonColor.White}
                    size="small"
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Clear
                  </Button>
                  <Button
                    color={ButtonColor.Black}
                    size="small"
                    disabled={
                      selectedIds.size === 0 ||
                      selectedIds.size > MIGRATE_RESPONSE_SNAPSHOTS_MAX_BATCH ||
                      submitting
                    }
                    onClick={handleSubmit}
                  >
                    {submitting
                      ? "Reassigning…"
                      : selectedIds.size > MIGRATE_RESPONSE_SNAPSHOTS_MAX_BATCH
                        ? `Too many selected (max ${MIGRATE_RESPONSE_SNAPSHOTS_MAX_BATCH})`
                        : `Reassign ${selectedIds.size} selected`}
                  </Button>
                </div>
              </div>

              {resultMessage && (
                <p className="text-sm text-green-700">{resultMessage}</p>
              )}

              <div className="space-y-3">
                {data.groups.map((group) => (
                  <SnapshotGroupCard
                    key={group.snapshot.id}
                    group={group}
                    latestSnapshot={data.latestSnapshot}
                    selectedIds={selectedIds}
                    onToggleResponse={toggleResponse}
                    onToggleGroup={toggleGroup}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default FormSnapshotMigration;
