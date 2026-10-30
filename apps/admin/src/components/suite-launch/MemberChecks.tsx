import type { UserDto } from "@alliance/shared/client";
import { cn } from "@alliance/shared/styles/util";
import UserSelect from "@alliance/sharedweb/ui/UserSelect";
import { Eye, LogIn } from "lucide-react";
import { useState } from "react";
import { getApiUrl } from "../../lib/config";
import { useUsersAdmin } from "../../lib/useUsersAdmin";
import {
  ActionLinks,
  iconControlClass,
  PreviewTaskFormLink,
} from "./ActionLinks";
import { overloadedMembers } from "./contractViolations";
import LaunchCheck from "./LaunchCheck";
import { actionMixes, MAX_MEMBER_MINUTES, type MemberLoad } from "./memberLoad";
import type { LaunchAction } from "./useSuiteLaunchData";

const nameOf = (users: Map<number, UserDto>, userId: number) =>
  users.get(userId)?.name ?? `User #${userId}`;

export const MemberPreview = ({
  loads,
  actions,
}: {
  loads: MemberLoad[];
  actions: LaunchAction[];
}) => {
  const { data: users = [], isLoading, isLoadingError } = useUsersAdmin();
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const usersById = new Map(users.map((user) => [user.id, user]));
  const loadsByUser = new Map(loads.map((load) => [load.userId, load]));
  const actionsById = new Map(actions.map(({ action }) => [action.id, action]));
  const overloaded = overloadedMembers(loads).length;
  const preview = (userIds: number[]) => {
    const userId = userIds.find((id) => !selectedUserIds.includes(id));
    if (userId !== undefined) setSelectedUserIds([...selectedUserIds, userId]);
  };
  return (
    <LaunchCheck
      title="Preview members' actions"
      passed={overloaded === 0}
      summary={
        overloaded === 0
          ? `No member gets more than ${MAX_MEMBER_MINUTES} minutes`
          : `${overloaded} of ${loads.length} members get more than ${MAX_MEMBER_MINUTES} minutes`
      }
    >
      <table className="w-fit text-sm [&_td]:py-2.5 [&_td]:pr-6 [&_th]:pr-6">
        <thead className="text-left text-xs text-zinc-500">
          <tr>
            <th className="font-normal">Members</th>
            <th className="font-normal">Minutes</th>
            <th className="font-normal">Actions</th>
            <th />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {actionMixes(loads).map((mix) => (
            <tr key={mix.actionIds.join(",")} className="align-top">
              <td>{mix.userIds.length}</td>
              <td
                className={cn(
                  mix.minutes > MAX_MEMBER_MINUTES &&
                    "font-medium text-red-600",
                )}
              >
                {mix.minutes}
              </td>
              <td>
                {mix.actionIds.map((id) => (
                  <span key={id} className="block">
                    {actionsById.get(id)?.name}
                  </span>
                ))}
              </td>
              <td className="text-right">
                <button
                  type="button"
                  onClick={() => preview(mix.userIds)}
                  aria-label="Preview a member who gets these actions"
                  title="Preview a member who gets these actions"
                  className={iconControlClass}
                >
                  <Eye className="size-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <UserSelect
        users={users}
        selectedUserIds={selectedUserIds}
        onChange={setSelectedUserIds}
        loading={isLoading}
        loadFailed={isLoadingError}
        label="Members"
      />
      {selectedUserIds.length > 0 && (
        <p className="text-xs text-zinc-500">
          Logging in as a member signs this browser out of the admin panel. Sign
          back in before launching; your launch progress is kept.
        </p>
      )}
      <ul className="divide-y divide-zinc-100">
        {selectedUserIds.map((userId) => {
          const load = loadsByUser.get(userId);
          return (
            <li key={userId} className="py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {nameOf(usersById, userId)}
                </span>
                <span className="text-xs text-zinc-500">
                  {load ? `${load.minutes} min` : "No actions assigned"}
                </span>
                <a
                  href={`${getApiUrl()}/auth/impersonate/${userId}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Log in as this member"
                  title="Log in as this member"
                  className={iconControlClass}
                >
                  <LogIn className="size-4" />
                </a>
              </div>
              <ul className="ml-4">
                {load?.actionIds.map((actionId) => {
                  const action = actionsById.get(actionId);
                  return (
                    <li
                      key={actionId}
                      className="flex items-center gap-1 text-sm"
                    >
                      <span className="flex-1">{action?.name}</span>
                      {action?.taskFormId != null && (
                        <PreviewTaskFormLink
                          formId={action.taskFormId}
                          userId={userId}
                        />
                      )}
                      <ActionLinks actionId={actionId} />
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </LaunchCheck>
  );
};
