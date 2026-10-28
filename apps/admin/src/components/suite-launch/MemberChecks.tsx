import type { UserDto } from "@alliance/shared/client";
import UserSelect from "@alliance/sharedweb/ui/UserSelect";
import { LogIn } from "lucide-react";
import { useState } from "react";
import { getApiUrl } from "../../lib/config";
import { useUsersAdmin } from "../../lib/useUsersAdmin";
import { ActionLinks, iconControlClass } from "./ActionLinks";
import { overloadedMembers } from "./launchBlockers";
import LaunchCheck from "./LaunchCheck";
import { MAX_MEMBER_MINUTES, type MemberLoad } from "./memberLoad";
import type { LaunchAction } from "./useSuiteLaunchData";

const SHOWN_OVERLOADED = 10;

const nameOf = (users: Map<number, UserDto>, userId: number) =>
  users.get(userId)?.name ?? `User #${userId}`;

export const MemberLoadCheck = ({
  loads,
  actions,
  acknowledged,
  onAcknowledgedChange,
}: {
  loads: MemberLoad[];
  actions: LaunchAction[];
  acknowledged: boolean;
  onAcknowledgedChange: (acknowledged: boolean) => void;
}) => {
  const { data: users = [] } = useUsersAdmin();
  const usersById = new Map(users.map((user) => [user.id, user]));
  const actionNames = new Map(
    actions.map(({ action }) => [action.id, action.name]),
  );
  const overloaded = overloadedMembers(loads);
  return (
    <LaunchCheck
      title={`No member gets more than ${MAX_MEMBER_MINUTES} minutes`}
      passed={overloaded.length === 0 || acknowledged}
      summary={`${overloaded.length} of ${loads.length} assigned members over`}
    >
      {overloaded.length > 0 && (
        <>
          <ul className="text-sm">
            {overloaded.slice(0, SHOWN_OVERLOADED).map((load) => (
              <li key={load.userId}>
                <span className="font-medium">
                  {nameOf(usersById, load.userId)}
                </span>
                : {load.minutes} min (
                {load.actionIds.map((id) => actionNames.get(id)).join(", ")})
              </li>
            ))}
          </ul>
          {overloaded.length > SHOWN_OVERLOADED && (
            <p className="text-xs text-zinc-500">
              and {overloaded.length - SHOWN_OVERLOADED} more
            </p>
          )}
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => onAcknowledgedChange(e.target.checked)}
            />
            These members are meant to get this much
          </label>
        </>
      )}
    </LaunchCheck>
  );
};

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
  return (
    <LaunchCheck title="Preview members' actions" passed>
      <UserSelect
        users={users}
        selectedUserIds={selectedUserIds}
        onChange={setSelectedUserIds}
        loading={isLoading}
        loadFailed={isLoadingError}
        label="Members"
      />
      <ul className="divide-y divide-zinc-100">
        {selectedUserIds.map((userId) => {
          const load = loadsByUser.get(userId);
          return (
            <li key={userId} className="py-2">
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
                {load?.actionIds.map((actionId) => (
                  <li
                    key={actionId}
                    className="flex items-center gap-1 text-sm"
                  >
                    <span className="flex-1">
                      {actionsById.get(actionId)?.name}
                    </span>
                    <ActionLinks actionId={actionId} />
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </LaunchCheck>
  );
};
