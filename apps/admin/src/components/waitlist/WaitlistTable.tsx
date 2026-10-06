import type {
  AdminWaitlistEntryDto,
  ContractEventType,
  WaitlistEntrySort,
  WaitlistInviteState,
} from "@alliance/shared/client/types.gen";
import {
  formatDateTime,
  formatMediumDateEnUS,
} from "@alliance/shared/lib/dateFormatters";
import { cn } from "@alliance/shared/styles/util";
import { ArrowDown, ArrowUp } from "lucide-react";
import React from "react";
import { INVITE_STATE_LABELS, SPAM_STATUSES } from "../../lib/waitlistFilter";
import SpamToggle from "./SpamToggle";

const CONTRACT_EVENT_LABELS: Record<ContractEventType, string> = {
  signed: "Signed",
  suspended: "Suspended",
};

const ACCOUNT_CREATED_LABELS: Record<WaitlistInviteState, string> = {
  none: "No",
  unused: "No",
  revoked: "No",
  claimed: "Yes",
};

enum SortColumn {
  Joined = "joined",
  Organization = "organization",
}

/** `first` is the order a click on an unsorted column picks. */
const SORTS: Record<
  SortColumn,
  { asc: WaitlistEntrySort; desc: WaitlistEntrySort; first: WaitlistEntrySort }
> = {
  [SortColumn.Joined]: {
    asc: "joined_asc",
    desc: "joined_desc",
    first: "joined_desc",
  },
  [SortColumn.Organization]: {
    asc: "organization_asc",
    desc: "organization_desc",
    first: "organization_asc",
  },
};

const SortHeader: React.FC<{
  column: SortColumn;
  label: string;
  sort: WaitlistEntrySort;
  onSortChange: (sort: WaitlistEntrySort) => void;
}> = ({ column, label, sort, onSortChange }) => {
  const { asc, desc, first } = SORTS[column];
  const direction = sort === asc ? "asc" : sort === desc ? "desc" : null;
  return (
    <th
      className="px-3 py-2 font-medium text-zinc-600"
      aria-sort={
        direction === "asc"
          ? "ascending"
          : direction === "desc"
            ? "descending"
            : undefined
      }
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-black"
        onClick={() =>
          onSortChange(
            direction === "desc" ? asc : direction === "asc" ? desc : first,
          )
        }
      >
        {label}
        {direction === "asc" && <ArrowUp size={14} />}
        {direction === "desc" && <ArrowDown size={14} />}
      </button>
    </th>
  );
};

type WaitlistTableProps = {
  entries: AdminWaitlistEntryDto[];
  selectedIds: ReadonlySet<number>;
  onSelectedIdsChange: (ids: Set<number>) => void;
  onDeselect: (id: number) => void;
  /** False while the rows shown belong to a previous search. */
  selectable: boolean;
  sort: WaitlistEntrySort;
  onSortChange: (sort: WaitlistEntrySort) => void;
  onFilterReferrer: (entryId: number) => void;
};

const WaitlistTable: React.FC<WaitlistTableProps> = ({
  entries,
  selectedIds,
  onSelectedIdsChange,
  onDeselect,
  selectable,
  sort,
  onSortChange,
  onFilterReferrer,
}) => {
  const pageSelected =
    entries.length > 0 && entries.every((entry) => selectedIds.has(entry.id));
  const pagePartlySelected =
    !pageSelected && entries.some((entry) => selectedIds.has(entry.id));

  const toggle = (ids: number[], selected: boolean) => {
    const next = new Set(selectedIds);
    for (const id of ids) {
      if (selected) next.add(id);
      else next.delete(id);
    }
    onSelectedIdsChange(next);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-zinc-100 text-left">
          <tr>
            <th className="px-3 py-2 w-8">
              <input
                type="checkbox"
                aria-label="Select this page"
                checked={pageSelected}
                ref={(el) => {
                  if (el) el.indeterminate = pagePartlySelected;
                }}
                disabled={!selectable}
                onChange={(e) =>
                  toggle(
                    entries.map((entry) => entry.id),
                    e.target.checked,
                  )
                }
              />
            </th>
            <th className="px-3 py-2 font-medium text-zinc-600">Person</th>
            <th className="px-3 py-2 font-medium text-zinc-600">Reason</th>
            <SortHeader
              column={SortColumn.Organization}
              label="Organization"
              sort={sort}
              onSortChange={onSortChange}
            />
            <th className="px-3 py-2 font-medium text-zinc-600">Link</th>
            <th className="px-3 py-2 font-medium text-zinc-600">Referrer</th>
            <SortHeader
              column={SortColumn.Joined}
              label="Joined"
              sort={sort}
              onSortChange={onSortChange}
            />
            <th className="px-3 py-2 font-medium text-zinc-600">Tags</th>
            <th className="px-3 py-2 font-medium text-zinc-600">Mobilized</th>
            <th className="px-3 py-2 font-medium text-zinc-600">Invite</th>
            <th className="px-3 py-2 font-medium text-zinc-600">
              Account created
            </th>
            <th className="px-3 py-2 font-medium text-zinc-600">
              Contract history
            </th>
            <th className="px-3 py-2 font-medium text-zinc-600">Spam</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {entries.map((entry) => (
            <tr
              key={entry.id}
              className={cn(
                "hover:bg-zinc-50 align-top",
                SPAM_STATUSES[entry.spamStatus].spamLike && "opacity-50",
              )}
            >
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  aria-label={`Select ${entry.name}`}
                  checked={selectedIds.has(entry.id)}
                  disabled={!selectable}
                  onChange={(e) => toggle([entry.id], e.target.checked)}
                />
              </td>
              <td className="px-3 py-2">
                <p className="font-medium text-zinc-900">{entry.name}</p>
                <p className="text-xs text-zinc-500">{entry.email}</p>
                {entry.unsubscribedAt && (
                  <p className="text-xs text-amber-700">Unsubscribed</p>
                )}
              </td>
              <td className="px-3 py-2 max-w-xs">
                <p
                  className="line-clamp-2 text-zinc-700"
                  title={entry.reason ?? ""}
                >
                  {entry.reason}
                </p>
              </td>
              <td className="px-3 py-2">{entry.organization?.name}</td>
              <td className="px-3 py-2">{entry.sourceLink?.channel}</td>
              <td className="px-3 py-2">
                {entry.referrer && (
                  <button
                    type="button"
                    className="text-blue-600 hover:underline text-left"
                    title={`Filter to entries ${entry.referrer.name} referred`}
                    onClick={() =>
                      entry.referrer && onFilterReferrer(entry.referrer.id)
                    }
                  >
                    {entry.referrer.name}
                  </button>
                )}
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {formatMediumDateEnUS(new Date(entry.createdAt))}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {entry.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-700"
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                {entry.mobilizedAt
                  ? formatMediumDateEnUS(new Date(entry.mobilizedAt))
                  : "Waiting"}
              </td>
              <td className="px-3 py-2">
                {INVITE_STATE_LABELS[entry.inviteState]}
              </td>
              <td className="px-3 py-2">
                {ACCOUNT_CREATED_LABELS[entry.inviteState]}
              </td>
              <td className="px-3 py-2">
                {entry.contractEvents.length ? (
                  <ul className="space-y-1 whitespace-nowrap">
                    {entry.contractEvents.map((event, index) => (
                      <li key={index}>
                        {CONTRACT_EVENT_LABELS[event.type]} ·{" "}
                        {formatDateTime(new Date(event.date))}
                      </li>
                    ))}
                  </ul>
                ) : (
                  "No contract events"
                )}
              </td>
              <td className="px-3 py-2">
                <SpamToggle
                  entry={entry}
                  onChanged={() => onDeselect(entry.id)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default WaitlistTable;
