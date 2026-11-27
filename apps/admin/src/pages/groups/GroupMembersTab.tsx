import type {
  CommunityDto,
  ProfileDto,
} from "@alliance/shared/client/types.gen";
import { useMemo, useRef, useState } from "react";
import { MembershipChange } from "../../lib/useCommunitiesAdmin";
import type { useCommunityMemberInfoAdmin } from "../../lib/useCommunityMemberInfoAdmin";
import { useConfirmOnPage } from "../../lib/useConfirmOnPage";
import type { useUsersAdmin } from "../../lib/useUsersAdmin";
import Button, { ButtonVariant } from "../../ui/Button";
import { EmptyState } from "../../ui/EmptyState";
import { PersonCell, personName } from "../../ui/PersonCell";
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
import { useFocusAfterRemoval } from "../../ui/useFocusAfterRemoval";
import { type AddChange, AddPersonDialog } from "./AddPersonDialog";
import { byPersonName } from "./groupRules";
import {
  type GroupErrorReporting,
  useGroupMembership,
} from "./useGroupMembership";

const nameOf = (person: ProfileDto) =>
  personName({ userId: person.id, name: person.displayName });

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
    clearError,
  });
  const addRef = useRef<HTMLButtonElement>(null);

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

  const focus = useFocusAfterRemoval({
    ids: people.map((person) => person.id),
    fallback: addRef,
  });

  const change = async (params: {
    person: ProfileDto;
    change: MembershipChange;
    fallback: string;
    removesRow: boolean;
  }) => {
    const { person, removesRow } = params;
    const removed = focus.removing(person.id);
    const result = await membership.apply({
      change: params.change,
      userId: person.id,
      fallback: params.fallback,
    });
    if (!result.ok) {
      reportError(result.error);
      return;
    }
    if (removesRow) removed();
  };

  const makeLeader = async (person: ProfileDto) => {
    const confirmed = await confirm({
      title: `Make ${nameOf(person)} a leader of ${group.name}?`,
      confirmLabel: "Make leader",
    });
    if (!confirmed) return;
    await change({
      person,
      change: MembershipChange.AddLeader,
      fallback: "Couldn't make them a leader.",
      removesRow: false,
    });
  };

  // From the server's removeLeaderAdmin: it changes the leaders only and
  // sends no notification.
  const removeLeader = async (person: ProfileDto) => {
    const confirmed = await confirm({
      title: `Remove ${nameOf(person)} as a leader of ${group.name}?`,
      message:
        "They no longer lead the group. Their membership doesn't change, and no one is notified.",
      confirmLabel: "Remove leader",
      destructive: true,
    });
    if (!confirmed) return;
    await change({
      person,
      change: MembershipChange.RemoveLeader,
      fallback: "Couldn't remove them as a leader.",
      removesRow: !memberIds.has(person.id),
    });
  };

  // From the server's removeUserFromCommunityAdmin: it removes them as a
  // leader too, and notifies them and the group's remaining leaders.
  const removeMember = async (person: ProfileDto) => {
    const confirmed = await confirm({
      title: `Remove ${nameOf(person)} from ${group.name}?`,
      message:
        "They leave the group, and stop leading it if they lead it. They get a notification that staff removed them, and so do the group's other leaders.",
      confirmLabel: "Remove from group",
      destructive: true,
    });
    if (!confirmed) return;
    await change({
      person,
      change: MembershipChange.RemoveMember,
      fallback: "Couldn't remove them from the group.",
      removesRow: true,
    });
  };

  return (
    <PageBody>
      <Panel
        title="Leaders and members"
        action={
          <div className="flex gap-2">
            <Button
              ref={addRef}
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
                <TableHead actions>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((person) => {
                const name = nameOf(person);
                const isLeader = leaderIds.has(person.id);
                return (
                  <TableRow key={person.id} {...focus.row(person.id)}>
                    <PersonCell
                      userId={person.id}
                      name={person.displayName}
                      profilePicture={person.profilePicture}
                      firstColumn
                    />
                    <TableCell>{isLeader ? "Leader" : "Member"}</TableCell>
                    <TableCell actions>
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
                          aria-label={`Remove from group: ${name}`}
                          busy={membership.isPending(
                            MembershipChange.RemoveMember,
                            person.id,
                          )}
                          onClick={() => void removeMember(person)}
                        >
                          Remove from group
                        </Button>
                      )}
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
