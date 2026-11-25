import { getMemberCount } from "@alliance/common/community";
import type {
  CommunityDto,
  ProfileDto,
} from "@alliance/shared/client/types.gen";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { countOf } from "../../lib/formatNumber";
import { MembershipChange } from "../../lib/useCommunitiesAdmin";
import type { useCommunityMemberInfoAdmin } from "../../lib/useCommunityMemberInfoAdmin";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import type { useUsersAdmin } from "../../lib/useUsersAdmin";
import Badge from "../../ui/Badge";
import Button, { ButtonVariant } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { nameLinkClass } from "../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { Panel } from "../../ui/templates/Overview";
import { PageBody } from "../../ui/templates/Page";
import { type AddChange, AddPersonDialog } from "./AddPersonDialog";
import { byPersonName, memberHref } from "./groupRules";
import {
  type GroupErrorReporting,
  useGroupMembership,
} from "./useGroupMembership";

const nameOf = (person: ProfileDto) =>
  person.displayName ?? `User #${person.id}`;

export function GroupMembersTab({
  group,
  refreshMemberInfo,
  users,
  reportError,
  clearError,
}: GroupErrorReporting & {
  group: CommunityDto;
  /** Reloads the Progress tab's data, which a membership change makes stale. */
  refreshMemberInfo: ReturnType<typeof useCommunityMemberInfoAdmin>["refresh"];
  users: ReturnType<typeof useUsersAdmin>;
}) {
  const confirm = useConfirmOnPage();
  const [adding, setAdding] = useState<AddChange | null>(null);
  const membership = useGroupMembership({
    group,
    refreshMemberInfo,
    reportError,
    clearError,
  });

  const memberIds = useMemo(
    () => new Set(group.users.map((member) => member.id)),
    [group],
  );
  const leaderIds = useMemo(
    () => new Set(group.leaders.map((leader) => leader.id)),
    [group],
  );
  // Leaders first. One the server doesn't also list as a member still gets a row.
  const people = useMemo(
    () => [
      ...[...group.leaders].sort(byPersonName),
      ...group.users
        .filter((member) => !leaderIds.has(member.id))
        .sort(byPersonName),
    ],
    [group, leaderIds],
  );

  const makeLeader = async (person: ProfileDto) => {
    const confirmed = await confirm({
      title: `Make ${nameOf(person)} a leader of ${group.name}?`,
      confirmLabel: "Make leader",
    });
    if (!confirmed) return;
    await membership.apply({
      change: MembershipChange.AddLeader,
      userId: person.id,
      fallback: "Unable to promote leader. Please try again.",
    });
  };

  const removeLeader = async (person: ProfileDto) => {
    const confirmed = await confirm({
      title: `Remove ${nameOf(person)} as a leader of ${group.name}?`,
      message: "They no longer lead this group.",
      confirmLabel: "Remove leader",
      destructive: true,
    });
    if (!confirmed) return;
    await membership.apply({
      change: MembershipChange.RemoveLeader,
      userId: person.id,
      fallback: "Unable to remove leader. Please try again.",
    });
  };

  const removeMember = async (person: ProfileDto) => {
    const confirmed = await confirm({
      title: `Remove ${nameOf(person)} from ${group.name}?`,
      message: "They are no longer a member of this group.",
      confirmLabel: "Remove member",
      destructive: true,
    });
    if (!confirmed) return;
    await membership.apply({
      change: MembershipChange.RemoveMember,
      userId: person.id,
      fallback: "Unable to remove member. Please try again.",
    });
  };

  return (
    <PageBody>
      <Panel
        title="Members"
        description={`${countOf(getMemberCount(group), "member")} · ${countOf(group.leaders.length, "leader")}`}
        action={
          <div className="flex gap-2">
            <Button
              size="small"
              variant={ButtonVariant.Default}
              onClick={() => setAdding(MembershipChange.AddMember)}
            >
              Add member…
            </Button>
            <Button
              size="small"
              variant={ButtonVariant.Default}
              onClick={() => setAdding(MembershipChange.AddLeader)}
            >
              Add leader…
            </Button>
          </div>
        }
        flush
      >
        {people.length === 0 ? (
          <EmptyState
            title="No members yet"
            description="Add a member or a leader to start the group."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((person) => {
                const name = nameOf(person);
                const isLeader = leaderIds.has(person.id);
                return (
                  <TableRow key={person.id}>
                    <TableCell className="max-w-64 truncate">
                      <Link
                        to={memberHref(person.id)}
                        className={nameLinkClass}
                      >
                        {name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {isLeader ? <Badge>Leader</Badge> : "Member"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {isLeader ? (
                          <Button
                            size="small"
                            aria-label={`Remove leader: ${name}`}
                            busy={membership.isPending(
                              MembershipChange.RemoveLeader,
                              person.id,
                            )}
                            onClick={() => void removeLeader(person)}
                          >
                            Remove leader
                          </Button>
                        ) : (
                          <Button
                            size="small"
                            aria-label={`Make leader: ${name}`}
                            busy={membership.isPending(
                              MembershipChange.AddLeader,
                              person.id,
                            )}
                            onClick={() => void makeLeader(person)}
                          >
                            Make leader
                          </Button>
                        )}
                        {memberIds.has(person.id) && (
                          <Button
                            size="small"
                            aria-label={`Remove: ${name}`}
                            busy={membership.isPending(
                              MembershipChange.RemoveMember,
                              person.id,
                            )}
                            onClick={() => void removeMember(person)}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>

      {adding && (
        <AddPersonDialog
          change={adding}
          users={users}
          membership={membership}
          onClose={() => setAdding(null)}
        />
      )}
    </PageBody>
  );
}
