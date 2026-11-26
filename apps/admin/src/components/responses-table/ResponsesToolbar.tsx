import { Layers, Link2, UnfoldVertical } from "lucide-react";
import React from "react";
import Button, { ButtonVariant } from "../../ui/Button";
import {
  FilterBar,
  FilterChip,
  listCount,
  SearchField,
} from "../../ui/templates/List";
import { SnapshotMode } from "./columns";
import ColumnVisibilityMenu from "./ColumnVisibilityMenu";
import type { ResponsesTableState } from "./useResponsesTable";

const ResponsesToolbar: React.FC<{ table: ResponsesTableState }> = ({
  table,
}) => {
  const { view, updateView, mode, selectedSnapshotId } = table;
  const expanded = mode === SnapshotMode.Expanded;
  return (
    <FilterBar
      count={listCount({
        shown: table.sortedRows.length,
        total: table.rows.length,
        noun: "response",
      })}
      actions={
        <>
          <Button
            variant={ButtonVariant.Default}
            size="small"
            onClick={() => updateView({ expandRows: !view.expandRows })}
            aria-pressed={view.expandRows}
            className="aria-pressed:bg-surface-2"
          >
            <UnfoldVertical aria-hidden="true" className="size-4" />
            Expand rows
          </Button>
          <ColumnVisibilityMenu
            columns={table.columns}
            hiddenColumns={table.hiddenColumns}
            onChange={(hidden) => updateView({ hiddenColumns: hidden })}
          />
          <Button
            variant={ButtonVariant.Default}
            size="small"
            onClick={() =>
              updateView({
                snapshotMode: expanded
                  ? SnapshotMode.Focused
                  : SnapshotMode.Expanded,
              })
            }
            title={
              expanded
                ? "Showing questions from every version in these responses"
                : "Showing the current version's questions only"
            }
          >
            {expanded ? "All versions" : "Current version"}
          </Button>
          <Button
            variant={ButtonVariant.Default}
            size="small"
            onClick={table.openVersions}
          >
            <Layers aria-hidden="true" className="size-4" />
            Versions
            <span className="text-fg-muted tabular-nums">
              {table.snapshotEntries.length}
            </span>
          </Button>
          <Button
            variant={ButtonVariant.Ghost}
            size="small"
            onClick={() => void table.copyViewLink()}
          >
            <Link2 aria-hidden="true" className="size-4" />
            {table.copied ? "Copied" : "Copy view link"}
          </Button>
        </>
      }
    >
      <SearchField
        label="Search responses"
        value={table.searchInput}
        onChange={table.setSearch}
      />
      {selectedSnapshotId !== null && (
        <FilterChip
          field="Version"
          value={`v${selectedSnapshotId}`}
          onRemove={() => table.selectVersion(null)}
        />
      )}
    </FilterBar>
  );
};

export default ResponsesToolbar;
