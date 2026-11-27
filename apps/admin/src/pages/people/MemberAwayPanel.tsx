import type { UserAwayRangeDto } from "@alliance/shared/client/types.gen";
import {
  AwayRangeStatus,
  awayRangeStatus,
  formatAwayReason,
} from "@alliance/shared/lib/awayRangesFormatters";
import { useRef, useState } from "react";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { formatCount } from "../../lib/formatNumber";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import type { useUserAwayRangesAdmin } from "../../lib/useUserAwayRangesAdmin";
import Badge, { BadgeTone } from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Panel } from "../../ui/templates/Overview";
import { ContentState, TableSkeleton } from "../../ui/templates/States";
import { useToast } from "../../ui/ToastProvider";
import { useFocusAfterRemoval } from "../../ui/useFocusAfterRemoval";
import { formatAwayRange } from "./awayRange";
import { MemberAwayDialog } from "./MemberAwayDialog";
import type { MemberErrorReporting } from "./memberRules";

const STATUS: Record<AwayRangeStatus, { label: string; tone: BadgeTone }> = {
  [AwayRangeStatus.Current]: { label: "Current", tone: BadgeTone.Warning },
  [AwayRangeStatus.Upcoming]: { label: "Upcoming", tone: BadgeTone.Info },
  [AwayRangeStatus.Past]: { label: "Past", tone: BadgeTone.Neutral },
};

type Editing = { range: UserAwayRangeDto | null } | null;

/** The member's away periods, scheduling one, and editing or deleting each. */
export function MemberAwayPanel({
  member,
  away,
  reportError,
  clearError,
}: MemberErrorReporting & {
  member: { id: number; name: string };
  away: ReturnType<typeof useUserAwayRangesAdmin>;
}) {
  const { query, sortedAwayRanges, deleteAwayRange } = away;
  const confirm = useConfirmOnPage();
  const { success } = useToast();
  const [editing, setEditing] = useState<Editing>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const scheduleRef = useRef<HTMLButtonElement>(null);
  const focus = useFocusAfterRemoval({
    ids: sortedAwayRanges.map((range) => range.id),
    fallback: scheduleRef,
  });

  // From the server's deleteAwayRange: an admin's delete removes the period
  // whether or not it has started, and notifies no one.
  const remove = async (range: UserAwayRangeDto) => {
    const confirmed = await confirm({
      title: `Delete the away period ${formatAwayRange(range)} for ${member.name}?`,
      message: "It is removed from their record. No one is notified.",
      confirmLabel: "Delete away period",
      destructive: true,
    });
    if (!confirmed) return;
    clearError();
    const removed = focus.removing(range.id);
    setDeletingId(range.id);
    try {
      await deleteAwayRange.mutateAsync(range.id);
      success("Away period deleted", member.name);
      removed();
    } catch (error) {
      reportError(
        adminRefusalMessage(error, "Couldn't delete the away period."),
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Panel
      title="Away periods"
      description={
        query.data ? formatCount(sortedAwayRanges.length) : undefined
      }
      action={
        <Button
          ref={scheduleRef}
          size="small"
          variant={ButtonVariant.Default}
          onClick={() => setEditing({ range: null })}
        >
          Schedule time away…
        </Button>
      }
      flush
    >
      <ContentState
        things="away periods"
        query={query}
        skeleton={<TableSkeleton columns={5} rows={2} />}
        empty={sortedAwayRanges.length === 0}
        emptyTitle="No away periods"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dates</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Note</TableHead>
              <TableHead actions>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedAwayRanges.map((range) => {
              const status = STATUS[awayRangeStatus(range)];
              const dates = formatAwayRange(range);
              return (
                <TableRow key={range.id} {...focus.row(range.id)}>
                  <TableCell className="font-medium">{dates}</TableCell>
                  <TableCell>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </TableCell>
                  <TableCell>{formatAwayReason(range.reason)}</TableCell>
                  <TableCell truncate>{range.note ?? "—"}</TableCell>
                  <TableCell actions>
                    <Button
                      size="small"
                      variant={ButtonVariant.Default}
                      aria-label={`Edit: ${dates}`}
                      onClick={() => setEditing({ range })}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      variant={ButtonVariant.Ghost}
                      aria-label={`Delete: ${dates}`}
                      busy={deletingId === range.id}
                      onClick={() => void remove(range)}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ContentState>
      {editing && (
        <MemberAwayDialog
          member={member}
          editing={editing.range}
          writes={away}
          finalFocus={() => scheduleRef.current}
          onClose={() => setEditing(null)}
        />
      )}
    </Panel>
  );
}
