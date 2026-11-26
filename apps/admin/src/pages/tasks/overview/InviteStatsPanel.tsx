import type { ShareUrlStatsDto } from "@alliance/shared/client";
import { countOf, formatCount } from "../../../lib/formatNumber";
import { PersonCell } from "../../../ui/PersonCell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../ui/Table";
import { Panel, PanelNote } from "../../../ui/templates/Overview";
import { TableSkeleton } from "../../../ui/templates/States";

const NUMBER = "text-right tabular-nums";

/**
 * A public-only task's form submissions through each member's share link.
 * A member whose link brought none isn't listed.
 */
export function InviteStatsPanel({
  stats,
  loading,
  failed,
}: {
  stats: ShareUrlStatsDto[];
  loading: boolean;
  failed: boolean;
}) {
  const total = stats.reduce((sum, stat) => sum + stat.inviteCount, 0);
  return (
    <Panel
      title="Invite stats"
      description={
        loading || failed
          ? undefined
          : `${countOf(total, "submission")} through members' links`
      }
      flush={loading || stats.length > 0}
    >
      {loading ? (
        <TableSkeleton
          columns={3}
          rows={3}
          columnClassNames={[undefined, NUMBER, NUMBER]}
        />
      ) : failed ? (
        <PanelNote>Couldn't load invite stats.</PanelNote>
      ) : stats.length === 0 ? (
        <PanelNote>No submissions through members' links yet.</PanelNote>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead className={NUMBER}>Form submissions</TableHead>
              <TableHead className={NUMBER}>Interested in joining</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.map((stat) => (
              <TableRow key={stat.sid}>
                <PersonCell
                  firstColumn
                  userId={stat.user.id}
                  name={stat.user.displayName}
                  profilePicture={stat.user.profilePicture}
                />
                <TableCell className={NUMBER}>
                  {formatCount(stat.inviteCount)}
                </TableCell>
                <TableCell className={NUMBER}>
                  {formatCount(stat.yesCount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}
