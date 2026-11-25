import { formatPhoneNumberForDisplay } from "@alliance/common/phone";
import type { CommunityDto, UserDto } from "@alliance/shared/client/types.gen";
import type { UseQueryResult } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { adminRefusalMessage } from "../../lib/adminRefusal";
import { countOf } from "../../lib/formatNumber";
import { useAssignGroupsAdmin } from "../../lib/useGroupAssignmentAdmin";
import { AvatarProfile } from "../../ui/Avatar";
import Button, { ButtonVariant } from "../../ui/Button";
import { cn } from "../../ui/cn";
import ConfirmDialog from "../../ui/ConfirmDialog";
import { Select } from "../../ui/Select";
import { linkClass, nameLinkClass } from "../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import { FilterBar, ListContent } from "../../ui/templates/List";
import {
  ContentState,
  LOAD_FAILED_FALLBACK,
  TableSkeleton,
} from "../../ui/templates/States";
import { useToast } from "../../ui/ToastProvider";
import { groupHref, memberHref } from "./groupRules";
import type {
  GroupAssignment,
  GroupAssignmentState,
} from "./useGroupAssignment";

/** A member's groups other than the ones they lead, which an assignment replaces. */
const groupsLeft = (member: UserDto) =>
  (member.communities ?? []).filter(
    (group) => !group.leaders?.some((leader) => leader.id === member.id),
  );

/** One line per member: who goes where, and which groups they leave for it. */
const assignmentSummary = (assignments: GroupAssignment[]) =>
  assignments
    .map(({ member, group }) => {
      const leaving = groupsLeft(member)
        .map((left) => left.name)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
      return leaving.length > 0
        ? `${member.name}: (Remove from: ${leaving.join(", ")}) → ${group.name}`
        : `${member.name}: ${group.name}`;
    })
    .join("\n");

export function AwaitingTab({
  queue,
  groups,
  assignment,
}: {
  queue: UseQueryResult<UserDto[]>;
  groups: UseQueryResult<CommunityDto[]>;
  assignment: GroupAssignmentState;
}) {
  const { success } = useToast();
  const assignGroups = useAssignGroupsAdmin();
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const members = queue.data ?? [];
  const { assignments, blocker } = assignment;

  const openConfirm = () => {
    setProblem(blocker);
    if (blocker === null) setConfirming(true);
  };

  const assign = () => {
    const assigned = assignments.map(({ member }) => member.id);
    assignGroups.mutate(
      {
        assignments: assignments.map(({ member, group }) => ({
          userId: member.id,
          communityId: group.id,
        })),
      },
      {
        onSuccess: () => {
          assignment.forget(assigned);
          success(`Assigned ${countOf(assigned.length, "member")}`);
        },
        onError: (error) =>
          setProblem(
            adminRefusalMessage(
              error,
              "Unable to confirm assignments. Please try again.",
            ),
          ),
        onSettled: () => setConfirming(false),
      },
    );
  };

  return (
    <>
      <FilterBar
        count={
          queue.data && `${countOf(members.length, "member")} awaiting a group`
        }
        actions={
          <Button
            size="small"
            variant={ButtonVariant.Primary}
            onClick={openConfirm}
          >
            Confirm assignments
          </Button>
        }
      >
        {problem && (
          <p role="alert" className="text-danger">
            {problem}
          </p>
        )}
      </FilterBar>
      <ListContent>
        <ContentState
          loading={queue.isPending}
          skeleton={<TableSkeleton bleed columns={5} />}
          error={
            queue.isLoadingError
              ? adminRefusalMessage(queue.error, LOAD_FAILED_FALLBACK)
              : null
          }
          errorTitle="Couldn't load members awaiting a group"
          onRetry={() => void queue.refetch()}
          empty={members.length === 0}
          emptyTitle="No one is awaiting a group"
        >
          <Table bleed>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Current groups</TableHead>
                <TableHead>New group</TableHead>
                <TableHead>
                  <span className="sr-only">Selected group</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <AwaitingRow
                  key={member.id}
                  member={member}
                  groupsLoading={groups.isLoading}
                  assignment={assignment}
                  onChoose={(groupId) => {
                    setProblem(null);
                    assignment.choose(member.id, groupId);
                  }}
                />
              ))}
            </TableBody>
          </Table>
        </ContentState>
      </ListContent>
      <ConfirmDialog
        open={confirming}
        title={`Assign ${countOf(assignments.length, "member")}?`}
        message={assignmentSummary(assignments)}
        confirmLabel="Assign members"
        busy={assignGroups.isPending}
        onConfirm={assign}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}

function AwaitingRow({
  member,
  groupsLoading,
  assignment,
  onChoose,
}: {
  member: UserDto;
  groupsLoading: boolean;
  assignment: GroupAssignmentState;
  onChoose: (groupId: string) => void;
}) {
  const current = groupsLeft(member);
  const picked = assignment.groupOf(member.id);
  const problem = assignment.problemOf(member.id);
  const problemId = `awaiting-${member.id}-problem`;
  return (
    <TableRow>
      <TableCell className="max-w-64">
        <span className="flex items-center gap-2.5">
          <AvatarProfile pfp={member.profilePicture} size="small" alt="" />
          <Link
            to={memberHref(member.id)}
            className={cn(nameLinkClass, "truncate")}
          >
            {member.name}
          </Link>
        </span>
      </TableCell>
      <TableCell className="max-w-64 truncate text-fg-muted">
        {[
          member.email,
          member.phoneNumber && formatPhoneNumberForDisplay(member.phoneNumber),
        ]
          .filter(Boolean)
          .join(" · ") || "—"}
      </TableCell>
      <TableCell className="max-w-64 truncate">
        {current.length === 0
          ? "—"
          : current.map((group, index) => (
              <span key={group.id}>
                {index > 0 && ", "}
                <Link to={groupHref(group)} className={linkClass}>
                  {group.name}
                </Link>
              </span>
            ))}
      </TableCell>
      <TableCell>
        <Select
          aria-label={`New group for ${member.name}`}
          aria-describedby={problem ? problemId : undefined}
          aria-invalid={problem ? true : undefined}
          className="h-control-sm w-56"
          value={picked ? String(picked.id) : ""}
          disabled={groupsLoading}
          onChange={(event) => onChoose(event.target.value)}
        >
          <option value="">
            {groupsLoading ? "Loading groups…" : "No group selected"}
          </option>
          {assignment.optionsFor(member.id).map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Select>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        {problem && (
          <span id={problemId} className="mr-3 text-danger">
            {problem}
          </span>
        )}
        {picked && (
          <Link to={groupHref(picked)} className={linkClass}>
            View group
          </Link>
        )}
      </TableCell>
    </TableRow>
  );
}
