import type {
  AdminWaitlistEntryDto,
  ContractEventType,
  WaitlistEntrySort,
  WaitlistInviteState,
  WaitlistSpamStatus,
} from "@alliance/shared/client/types.gen";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";
import { formatDate, formatDateTime } from "../../lib/formatDate";
import { waitlistContactLabel } from "../../lib/waitlistContact";
import { INVITE_STATE_LABELS, SPAM_STATUSES } from "../../lib/waitlistFilter";
import Badge, { BadgeTone } from "../../ui/Badge";
import { Checkbox } from "../../ui/Checkbox";
import { cn } from "../../ui/cn";
import { linkClass } from "../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import {
  EntryDialog,
  EntryRowActions,
  type EntryAfterWrite,
} from "./EntryRowActions";

const CONTRACT_EVENT_LABELS: Record<ContractEventType, string> = {
  signed: "Signed",
  suspended: "Suspended",
};

const ACCOUNT_CREATED: Record<WaitlistInviteState, string> = {
  none: "No",
  unused: "No",
  revoked: "No",
  claimed: "Yes",
};

const INVITE_TONES: Record<WaitlistInviteState, BadgeTone> = {
  none: BadgeTone.Neutral,
  unused: BadgeTone.Info,
  claimed: BadgeTone.Success,
  revoked: BadgeTone.Neutral,
};

const SPAM_TONES: Record<WaitlistSpamStatus, BadgeTone> = {
  clean: BadgeTone.Neutral,
  not_spam: BadgeTone.Neutral,
  suspected: BadgeTone.Warning,
  spam: BadgeTone.Danger,
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

/** The table's column count, for a detail row or a skeleton. */
export const ENTRY_COLUMNS = 16;

function SortHead({
  column,
  label,
  sort,
  onSortChange,
}: {
  column: SortColumn;
  label: string;
  sort: WaitlistEntrySort;
  onSortChange: (sort: WaitlistEntrySort) => void;
}) {
  const { asc, desc, first } = SORTS[column];
  const direction = sort === asc ? "asc" : sort === desc ? "desc" : null;
  return (
    <TableHead
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
        className="-mx-1 inline-flex items-center gap-1 rounded-sm px-1 focus-ring hover:text-fg"
        onClick={() =>
          onSortChange(
            direction === "desc" ? asc : direction === "asc" ? desc : first,
          )
        }
      >
        {label}
        {direction === "asc" && (
          <ArrowUp aria-hidden="true" className="size-3.5" />
        )}
        {direction === "desc" && (
          <ArrowDown aria-hidden="true" className="size-3.5" />
        )}
      </button>
    </TableHead>
  );
}

const orDash = (value: ReactNode) => value || "—";

export function EntriesTable({
  entries,
  selected,
  onSelectedChange,
  selectable,
  sort,
  onSortChange,
  onFilterReferrer,
  onOpen,
  onSpamChanged,
  onWriting,
  focusRow,
  onFailure,
}: {
  entries: AdminWaitlistEntryDto[];
  selected: ReadonlySet<number>;
  onSelectedChange: (ids: ReadonlySet<number>) => void;
  /** False while the rows shown belong to a previous search. */
  selectable: boolean;
  sort: WaitlistEntrySort;
  onSortChange: (sort: WaitlistEntrySort) => void;
  onFilterReferrer: (entryId: number) => void;
  onOpen: (entry: AdminWaitlistEntryDto, dialog: EntryDialog) => void;
  onSpamChanged: (entryId: number) => void;
  onWriting: (entryId: number, after: EntryAfterWrite) => () => void;
  /** `useFocusAfterRemoval`'s `row`. */
  focusRow: (entryId: number) => Record<string, string>;
  onFailure: (message: string) => void;
}) {
  const pageSelected =
    entries.length > 0 && entries.every((entry) => selected.has(entry.id));
  const pagePartlySelected =
    !pageSelected && entries.some((entry) => selected.has(entry.id));

  const toggle = (ids: number[], on: boolean) => {
    const next = new Set(selected);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    onSelectedChange(next);
  };

  return (
    <Table bleed stickyActions>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              aria-label="Select this page"
              checked={pageSelected}
              ref={(el) => {
                if (el) el.indeterminate = pagePartlySelected;
              }}
              disabled={!selectable}
              onChange={(event) =>
                toggle(
                  entries.map((entry) => entry.id),
                  event.target.checked,
                )
              }
            />
          </TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Nonprofit nominations</TableHead>
          <SortHead
            column={SortColumn.Organization}
            label="Organization"
            sort={sort}
            onSortChange={onSortChange}
          />
          <TableHead>Link</TableHead>
          <TableHead>Referrer</TableHead>
          <SortHead
            column={SortColumn.Joined}
            label="Joined"
            sort={sort}
            onSortChange={onSortChange}
          />
          <TableHead>Tags</TableHead>
          <TableHead>Mobilized</TableHead>
          <TableHead>Invite</TableHead>
          <TableHead>Account created</TableHead>
          <TableHead>Contract history</TableHead>
          <TableHead>Spam</TableHead>
          <TableHead actions>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => {
          const contact = waitlistContactLabel(entry);
          const nominations = entry.nonprofitNominations?.replace(/\s+/g, " ");
          const tags = entry.tags.map((tag) => tag.name).join(", ");
          const contracts = entry.contractEvents.map(
            (event) =>
              `${CONTRACT_EVENT_LABELS[event.type]} · ${formatDateTime(event.date)}`,
          );
          return (
            <TableRow
              key={entry.id}
              aria-selected={selected.has(entry.id)}
              {...focusRow(entry.id)}
            >
              <TableCell>
                <Checkbox
                  aria-label={`Select ${entry.name}`}
                  checked={selected.has(entry.id)}
                  disabled={!selectable}
                  onChange={(event) => toggle([entry.id], event.target.checked)}
                />
              </TableCell>
              <TableCell className="font-medium">{entry.name}</TableCell>
              <TableCell className="whitespace-nowrap">
                <span className="text-fg-muted">{orDash(contact)}</span>
                {entry.unsubscribedAt && (
                  <Badge className="ml-2">Unsubscribed</Badge>
                )}
              </TableCell>
              <TableCell truncate>{orDash(entry.reason)}</TableCell>
              <TableCell truncate>{orDash(nominations)}</TableCell>
              <TableCell truncate>{orDash(entry.organization?.name)}</TableCell>
              <TableCell truncate>
                {orDash(entry.sourceLink?.channel)}
              </TableCell>
              <TableCell truncate title={entry.referrer?.name}>
                {entry.referrer ? (
                  <button
                    type="button"
                    className={cn(linkClass, "text-left")}
                    title={`Show the entries ${entry.referrer.name} referred`}
                    onClick={() =>
                      entry.referrer && onFilterReferrer(entry.referrer.id)
                    }
                  >
                    {entry.referrer.name}
                  </button>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {formatDate(entry.createdAt)}
              </TableCell>
              <TableCell truncate title={tags || undefined}>
                {entry.tags.length ? (
                  <span className="flex gap-1">
                    {entry.tags.map((tag) => (
                      <Badge key={tag.id}>{tag.name}</Badge>
                    ))}
                  </span>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {entry.mobilizedAt ? formatDate(entry.mobilizedAt) : "Waiting"}
              </TableCell>
              <TableCell>
                <Badge tone={INVITE_TONES[entry.inviteState]}>
                  {INVITE_STATE_LABELS[entry.inviteState]}
                </Badge>
              </TableCell>
              <TableCell>{ACCOUNT_CREATED[entry.inviteState]}</TableCell>
              <TableCell
                truncate
                title={contracts.join("\n") || "No contract events"}
              >
                {contracts.length ? (
                  <ul className="flex gap-3">
                    {contracts.map((line, index) => (
                      <li key={index}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  "No contract events"
                )}
              </TableCell>
              <TableCell>
                <Badge tone={SPAM_TONES[entry.spamStatus]}>
                  {SPAM_STATUSES[entry.spamStatus].label}
                </Badge>
              </TableCell>
              <TableCell actions>
                <EntryRowActions
                  entry={entry}
                  onOpen={(dialog) => onOpen(entry, dialog)}
                  onSpamChanged={() => onSpamChanged(entry.id)}
                  onWriting={(after) => onWriting(entry.id, after)}
                  onFailure={onFailure}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
