import { UserDto, userMembers } from "@alliance/shared/client";
import {
  matchesName,
  useUserSelection,
} from "@alliance/shared/lib/useUserSelection";
import React, { useEffect, useMemo, useState } from "react";
import { AvatarProfile } from "./Avatar";

export type UserSelectUser = Pick<UserDto, "id" | "name" | "profilePicture">;

interface UserSelectProps {
  users: UserSelectUser[];
  selectedUserIds: number[];
  onChange: (userIds: number[]) => void;
  loading?: boolean;
  label?: string | null;
  single?: boolean;
}

const nameOf = (user: UserSelectUser) => user.name;
const missingUser = (id: number): UserSelectUser => ({
  id,
  name: `User #${id}`,
  profilePicture: null,
});

const UserSelect: React.FC<UserSelectProps> = ({
  users,
  selectedUserIds,
  onChange,
  loading = false,
  label = "Recipients",
  single = false,
}) => {
  const [filterQuery, setFilterQuery] = useState<string>("");
  const [filterOpen, setFilterOpen] = useState(false);
  const {
    query,
    setQuery,
    canSelectMore,
    selectedUsers,
    filteredUsers,
    addUser,
    removeUser,
    inputDisabled,
    placeholder,
  } = useUserSelection({
    users,
    selectedUserIds,
    onChange,
    nameOf,
    missingUser,
    loading,
    single,
  });

  const displayedSelectedUsers = useMemo(() => {
    if (!filterQuery.trim()) return selectedUsers;
    return selectedUsers.filter((user) => matchesName(user.name, filterQuery));
  }, [selectedUsers, filterQuery]);

  return (
    <div className="relative min-h-20">
      {label && (
        <label className="block text-sm font-medium text-zinc-700 mb-1">
          {label}
        </label>
      )}
      {canSelectMore && (
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          disabled={inputDisabled}
          className="w-full border border-zinc-300 rounded px-3 py-3 text-sm disabled:bg-zinc-100 disabled:text-zinc-500"
        />
      )}
      {query && filteredUsers.length > 0 && (
        <div className="border border-zinc-200 rounded bg-white max-h-48 overflow-y-auto absolute left-0 w-full z-10">
          {filteredUsers.map((user) => (
            <button
              type="button"
              key={user.id}
              className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 flex flex-row items-center gap-x-2"
              onClick={() => addUser(user.id)}
            >
              <AvatarProfile pfp={user.profilePicture} size="medium" />
              <span className="font-medium">
                {user.name ?? `User #${user.id}`}
              </span>
            </button>
          ))}
        </div>
      )}
      {query && !filteredUsers.length && !loading && (
        <p className="mt-2 text-xs text-zinc-500">
          No users match that search.
        </p>
      )}
      {selectedUsers.length > 0 && (
        <div className="my-1 flex items-center gap-2">
          {filterOpen ? (
            <>
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter selected users..."
                className="flex-1 border border-zinc-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setFilterOpen(false);
                  setFilterQuery("");
                }}
                className="text-xs text-zinc-500 hover:text-zinc-700"
              >
                Clear
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className="text-xs text-zinc-500 hover:text-zinc-700"
            >
              Filter ({selectedUsers.length})
            </button>
          )}
        </div>
      )}
      <div className="my-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {displayedSelectedUsers.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between border border-zinc-200 rounded px-3 py-2 text-sm bg-zinc-50"
          >
            <div className="flex items-center gap-x-2 min-w-0">
              <AvatarProfile pfp={user.profilePicture} size="medium" />
              <p className="font-medium truncate">
                {user.name ?? `User #${user.id}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => removeUser(user.id)}
              className="text-xs text-red-600 hover:text-red-700 flex-shrink-0 ml-1"
            >
              ✕
            </button>
          </div>
        ))}
        {selectedUsers.length === 0 && !single && (
          <p className="text-xs text-zinc-500">
            Selected users will appear here.
          </p>
        )}
      </div>
    </div>
  );
};

export default UserSelect;

export const useSelectableUserIds = () => {
  const [users, setUsers] = useState<UserSelectUser[]>([]);
  useEffect(() => {
    userMembers().then((response) => {
      setUsers(
        response.data?.map((user) => ({
          id: user.id,
          name: user.displayName,
          profilePicture: user.profilePicture,
        })) ?? [],
      );
    });
  }, []);
  return users;
};
