import { pickForCount } from "@alliance/common/plural";
import type { UserDto } from "@alliance/shared/client";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { overloadedMembers } from "../../../components/suite-launch/contractViolations";
import {
  actionMixes,
  isOverloaded,
  MAX_MEMBER_MINUTES,
  type MemberLoad,
} from "../../../components/suite-launch/memberLoad";
import type { LaunchAction } from "../../../components/suite-launch/useSuiteLaunchData";
import { getApiUrl } from "../../../lib/config";
import { countOf, formatCount } from "../../../lib/formatNumber";
import Button, { ButtonVariant } from "../../../ui/Button";
import { cn } from "../../../ui/cn";
import NewTabMark from "../../../ui/NewTabMark";
import { linkClass } from "../../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../ui/Table";
import UserSelect from "../../../ui/UserSelect";
import { LaunchCheck } from "./LaunchCheck";
import { PreviewTaskFormLink, TaskLinks } from "./TaskLinks";

function Minutes({ minutes }: { minutes: number }) {
  const over = isOverloaded(minutes);
  return (
    <span className={cn("tabular-nums", over && "font-semibold text-danger")}>
      {over && <TriangleAlert className="mr-1 inline size-3.5" aria-hidden />}
      <span className={cn(over && "text-danger")}>{minutes}</span>
      {over && (
        <span className="sr-only">{` over ${MAX_MEMBER_MINUTES} minutes`}</span>
      )}
    </span>
  );
}

/** Who gets which tasks, how long they take, and any member's own view. */
export function MembersCheck({
  loads,
  actions,
  users,
  usersLoadFailed,
}: {
  loads: MemberLoad[] | null;
  actions: LaunchAction[];
  users: UserDto[];
  usersLoadFailed: boolean;
}) {
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const usersById = new Map(users.map((user) => [user.id, user]));
  const loadsByUser = new Map((loads ?? []).map((load) => [load.userId, load]));
  const actionsById = new Map(actions.map(({ action }) => [action.id, action]));
  const variantFormsById = new Map(
    actions.map(({ action, variantForms }) => [action.id, variantForms]),
  );
  const overloaded = loads ? overloadedMembers(loads).length : 0;
  const preview = (userIds: number[]) => {
    const userId = userIds.find((id) => !selectedUserIds.includes(id));
    if (userId !== undefined) setSelectedUserIds([...selectedUserIds, userId]);
  };
  const mixes = actionMixes(loads ?? []);

  return (
    <LaunchCheck
      title="Members' tasks"
      passed={loads !== null && overloaded === 0}
      summary={
        !loads
          ? "Minutes unknown until every member count loads"
          : overloaded === 0
            ? `No member gets more than ${MAX_MEMBER_MINUTES} minutes`
            : `${formatCount(overloaded)} of ${countOf(loads.length, "member")} ${pickForCount(overloaded, "gets", "get")} more than ${MAX_MEMBER_MINUTES} minutes`
      }
      flush
    >
      {mixes.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">Members</TableHead>
              <TableHead className="text-right">Time (min)</TableHead>
              <TableHead>Tasks they get</TableHead>
              <TableHead actions>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mixes.map((mix) => (
              <TableRow key={mix.actionIds.join(",")}>
                <TableCell className="text-right tabular-nums">
                  {formatCount(mix.userIds.length)}
                </TableCell>
                <TableCell className="text-right">
                  <Minutes minutes={mix.minutes} />
                </TableCell>
                <TableCell className="py-2">
                  <ul>
                    {mix.actionIds.map((id) => (
                      <li key={id}>{actionsById.get(id)?.name}</li>
                    ))}
                  </ul>
                </TableCell>
                <TableCell actions>
                  <Button
                    size="small"
                    variant={ButtonVariant.Default}
                    aria-label="Preview a member who gets these tasks"
                    onClick={() => preview(mix.userIds)}
                  >
                    Preview a member
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <div className="flex flex-col gap-4 border-t border-line p-card">
        <UserSelect
          users={users}
          selectedUserIds={selectedUserIds}
          onChange={setSelectedUserIds}
          loadFailed={usersLoadFailed}
          label="Members"
        />
        {selectedUserIds.length > 0 && (
          <p className="text-caption text-fg-muted">
            Logging in as a member signs this browser out of the admin panel.
            Sign back in before launching; your launch progress is kept.
          </p>
        )}
        {selectedUserIds.length > 0 && (
          <ul className="divide-y divide-line rounded-card border border-line">
            {selectedUserIds.map((userId) => {
              const load = loadsByUser.get(userId);
              return (
                <li key={userId} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex flex-wrap items-baseline gap-x-3">
                    <span className="font-medium">
                      {usersById.get(userId)?.name ?? `User #${userId}`}
                    </span>
                    <span className="text-caption text-fg-muted">
                      {load
                        ? `${load.minutes} min`
                        : loads
                          ? "No tasks assigned"
                          : "Tasks unknown"}
                    </span>
                    <a
                      href={`${getApiUrl()}/auth/impersonate/${userId}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Log in as this member"
                      className={cn(linkClass, "ml-auto text-caption")}
                    >
                      Log in
                      <NewTabMark />
                    </a>
                  </div>
                  {load && (
                    <ul className="flex flex-col gap-1.5 pl-4">
                      {load.actionIds.map((actionId) => {
                        const action = actionsById.get(actionId);
                        return (
                          <li
                            key={actionId}
                            className="flex flex-wrap items-baseline justify-between gap-x-4"
                          >
                            <span>{action?.name}</span>
                            <span className="flex flex-wrap items-center gap-3 text-caption">
                              {action?.taskFormId != null && (
                                <PreviewTaskFormLink
                                  formId={action.taskFormId}
                                  userId={userId}
                                  variantName={null}
                                />
                              )}
                              {variantFormsById
                                .get(actionId)
                                ?.map(({ formId, name }) => (
                                  <PreviewTaskFormLink
                                    key={formId}
                                    formId={formId}
                                    userId={userId}
                                    variantName={name}
                                  />
                                ))}
                              <TaskLinks actionId={actionId} />
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </LaunchCheck>
  );
}
