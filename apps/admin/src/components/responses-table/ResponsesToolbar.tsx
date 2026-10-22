import { withCount } from "@alliance/common/plural";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import { Layers, Link2, Search, UnfoldVertical } from "lucide-react";
import React from "react";
import { SnapshotMode } from "./columns";
import ColumnVisibilityMenu from "./ColumnVisibilityMenu";
import type { StoredView } from "./persistence";
import type { TableColumn } from "./types";

type ResponsesToolbarProps = {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  expandRows: boolean;
  mode: SnapshotMode;
  onViewChange: (patch: Partial<StoredView>) => void;
  columns: readonly TableColumn[];
  hiddenColumns: ReadonlySet<string>;
  versionCount: number;
  onOpenVersions: () => void;
  copied: boolean;
  onCopyViewLink: () => void;
  shownCount: number;
  totalCount: number;
};

const ResponsesToolbar: React.FC<ResponsesToolbarProps> = ({
  searchInput,
  onSearchInputChange,
  expandRows,
  mode,
  onViewChange,
  columns,
  hiddenColumns,
  versionCount,
  onOpenVersions,
  copied,
  onCopyViewLink,
  shownCount,
  totalCount,
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <div className="relative">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-400"
      />
      <input
        type="search"
        value={searchInput}
        onChange={(event) => onSearchInputChange(event.target.value)}
        placeholder="Search responses…"
        aria-label="Search responses"
        className="w-64 rounded-md border border-gray-300 bg-white py-1.5 pr-3 pl-8 text-sm text-gray-900 focus:border-black focus:outline-none"
      />
    </div>

    <Button
      color={expandRows ? ButtonColor.Black : ButtonColor.White}
      size="small"
      onClick={() => onViewChange({ expandRows: !expandRows })}
      aria-pressed={expandRows}
    >
      <UnfoldVertical aria-hidden="true" className="mr-1.5 size-4" />
      Expand rows
    </Button>

    <ColumnVisibilityMenu
      columns={columns}
      hiddenColumns={hiddenColumns}
      onChange={(hidden) => onViewChange({ hiddenColumns: hidden })}
    />

    <Button color={ButtonColor.White} size="small" onClick={onOpenVersions}>
      <Layers aria-hidden="true" className="mr-1.5 size-4" />
      Versions
      <span className="ml-1.5 text-zinc-500">{versionCount}</span>
    </Button>

    <Button
      color={
        mode === SnapshotMode.Expanded ? ButtonColor.Black : ButtonColor.White
      }
      size="small"
      onClick={() =>
        onViewChange({
          snapshotMode:
            mode === SnapshotMode.Expanded
              ? SnapshotMode.Focused
              : SnapshotMode.Expanded,
        })
      }
      title={
        mode === SnapshotMode.Expanded
          ? "Showing questions from every version in these responses"
          : "Showing the current version's questions only"
      }
    >
      {mode === SnapshotMode.Expanded ? "All versions" : "Current version"}
    </Button>

    <Button color={ButtonColor.White} size="small" onClick={onCopyViewLink}>
      <Link2 aria-hidden="true" className="mr-1.5 size-4" />
      {copied ? "Copied" : "Copy view link"}
    </Button>

    <span className="ml-auto text-sm text-zinc-500">
      {withCount(shownCount, "response")}
      {shownCount !== totalCount && ` of ${totalCount}`}
    </span>
  </div>
);

export default ResponsesToolbar;
