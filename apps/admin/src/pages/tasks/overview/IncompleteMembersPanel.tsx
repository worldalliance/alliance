import type { ProfileDto } from "@alliance/shared/client";
import { useId, useState } from "react";
import { countOf } from "../../../lib/formatNumber";
import { PersonCell } from "../../../ui/PersonCell";
import {
  ExpandToggle,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../ui/Table";
import { Panel, PanelNote } from "../../../ui/templates/Overview";

/** The members who joined and didn't complete, folded away until asked for. */
export function IncompleteMembersPanel({
  users,
  loading,
  failed,
}: {
  users: ProfileDto[];
  loading: boolean;
  failed: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  return (
    <Panel
      title="Members who failed to complete"
      flush={users.length > 0}
      action={
        users.length > 0 && (
          <ExpandToggle
            expanded={expanded}
            controls={listId}
            onToggle={() => setExpanded((open) => !open)}
          >
            {expanded ? "Hide" : "Show"} {countOf(users.length, "member")}
          </ExpandToggle>
        )
      }
    >
      {loading ? (
        <PanelNote>Loading…</PanelNote>
      ) : failed ? (
        <PanelNote>Couldn't load who failed to complete.</PanelNote>
      ) : (
        <div id={listId} className="max-h-96 overflow-y-auto">
          {expanded && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <PersonCell
                      firstColumn
                      userId={user.id}
                      name={user.displayName}
                      profilePicture={user.profilePicture}
                    />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </Panel>
  );
}
