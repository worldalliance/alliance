import { formatCount } from "../../lib/formatNumber";
import { useOnetimeInviteMemberStatsAdmin } from "../../lib/useOnetimeInvitesAdmin";
import { PersonCell } from "../../ui/PersonCell";
import Sheet from "../../ui/Sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import {
  ContentState,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";

const NUMBER = "text-right tabular-nums";

/**
 * How many one-time invites were created in each member's name, whether or
 * not anyone passed them on, and how many of those were accepted.
 */
export function InvitesPerMemberSheet({ onClose }: { onClose: () => void }) {
  const stats = useOnetimeInviteMemberStatsAdmin();
  return (
    <Sheet open onClose={onClose} title="Invites per member" size="wide">
      <RefreshFailedBanner things="invites per member" query={stats} />
      <ContentState
        things="invites per member"
        query={stats}
        refreshBanner={false}
        skeleton={
          <TableSkeleton
            columns={3}
            columnClassNames={[undefined, NUMBER, NUMBER]}
          />
        }
        empty={stats.data?.length === 0}
        emptyTitle="No invites in a member's name yet"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead className="text-right">Created</TableHead>
              <TableHead className="text-right">Accepted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(stats.data ?? []).map((row) => (
              <TableRow key={row.invitingUser.id}>
                <PersonCell
                  userId={row.invitingUser.id}
                  name={row.invitingUser.displayName}
                  profilePicture={row.invitingUser.profilePicture}
                  firstColumn
                />
                <TableCell className={NUMBER}>
                  {formatCount(row.sent)}
                </TableCell>
                <TableCell className={NUMBER}>
                  {formatCount(row.accepted)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ContentState>
    </Sheet>
  );
}
