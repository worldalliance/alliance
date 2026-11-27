import type { UserAdminDetailDto } from "@alliance/shared/client/types.gen";
import { formatDate } from "../../lib/formatDate";
import Badge from "../../ui/Badge";
import { EmptyState } from "../../ui/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Panel } from "../../ui/templates/Overview";
import {
  CONTRACT_STANDING,
  contractStanding,
  EVENT_STANDING,
} from "./memberRules";

/** The member's contract standing and every signing and suspension, newest first. */
export function MemberContractPanel({ user }: { user: UserAdminDetailDto }) {
  const standing = CONTRACT_STANDING[contractStanding(user)];
  const events = [...(user.contractEvents ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  return (
    <Panel
      title="Contract"
      description={<Badge tone={standing.tone}>{standing.label}</Badge>}
      flush
    >
      {events.length === 0 ? (
        <EmptyState title="No contract events" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => (
              <TableRow key={`${event.type}-${event.date}`}>
                <TableCell>
                  {CONTRACT_STANDING[EVENT_STANDING[event.type]].label}
                </TableCell>
                <TableCell>{formatDate(event.date)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Panel>
  );
}
