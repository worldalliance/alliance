import type { ActionWithdrawalDto, ProfileDto } from "@alliance/shared/client";
import React from "react";
import { countOf } from "../../lib/formatNumber";
import Sheet from "../../ui/Sheet";
import { Banner, BannerTone } from "../../ui/templates/Banner";
import { ListContent } from "../../ui/templates/List";
import { ContentState, TableSkeleton } from "../../ui/templates/States";
import type { FormWithSchema } from "../FormResponsesView";
import ResponseDrawer from "./ResponseDrawer";
import ResponsesGrid from "./ResponsesGrid";
import ResponsesToolbar from "./ResponsesToolbar";
import SnapshotNavigator from "./SnapshotNavigator";
import type { ResponsesTableState } from "./useResponsesTable";

export type ResponsesTableViewProps = {
  table: ResponsesTableState;
  form: FormWithSchema | null;
  withdrawnUserMap: Map<number, ActionWithdrawalDto>;
  sidsToUserMap: Record<string, ProfileDto>;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  /** Goes to the form's Versions tab, asking which form where there are several. */
  onReassign: (() => void) | null;
};

/**
 * The Responses view's body: its filter bar, then the table filling the rest
 * and scrolling both ways under a sticky header and first column.
 */
export const ResponsesTableView: React.FC<ResponsesTableViewProps> = ({
  table,
  form,
  withdrawnUserMap,
  sidsToUserMap,
  loading,
  error,
  onRetry,
  onReassign,
}) => {
  const { fieldSet } = table;
  return (
    <>
      <ResponsesToolbar table={table} />
      {!loading && !error && fieldSet.failures.length > 0 && (
        <Banner tone={BannerTone.Danger}>
          <p>
            {countOf(fieldSet.failures.length, "schema version")} couldn't be
            read, so their questions have no columns.
          </p>
          <ul>
            {fieldSet.failures.map((failure) => (
              <li key={failure.snapshotId ?? "current"}>
                v{failure.snapshotId ?? "?"}: {failure.message}
              </li>
            ))}
          </ul>
        </Banner>
      )}
      <ListContent>
        <ContentState
          loading={loading}
          skeleton={
            <>
              <span className="sr-only">Loading responses...</span>
              <TableSkeleton bleed columns={6} />
            </>
          }
          error={error}
          errorTitle="Couldn't load responses"
          onRetry={onRetry}
          empty={table.sortedRows.length === 0}
          filtered={table.rows.length > 0 && table.filtered}
          onClearFilters={table.clearFilters}
          emptyTitle="No responses yet"
        >
          <ResponsesGrid
            visibleColumns={table.visibleColumns}
            rows={table.sortedRows}
            expandAll={table.view.expandRows}
            expandedRowIds={table.expandedRowIds}
            onToggleRow={table.toggleRow}
            openResponseId={table.openResponseId}
            responseSearch={table.responseSearch}
            query={table.query}
          />
        </ContentState>
      </ListContent>

      <Sheet
        open={table.versionsOpen}
        onClose={table.closeVersions}
        title="Versions"
      >
        <SnapshotNavigator
          open={table.versionsOpen}
          entries={table.snapshotEntries}
          fields={fieldSet}
          formIds={table.responseFormIds}
          selectedSnapshotId={table.selectedSnapshotId}
          onSelectVersion={table.selectVersion}
          onReassign={onReassign}
        />
      </Sheet>

      <ResponseDrawer
        response={table.openResponse}
        form={form}
        sidsToUserMap={sidsToUserMap}
        withdrawnUserMap={withdrawnUserMap}
        position={{ index: table.openIndex, total: table.sortedRows.length }}
        onClose={table.closeResponse}
        onStep={table.stepResponse}
      />
    </>
  );
};

export default ResponsesTableView;
