import {
  matchesName,
  useUserSelection,
} from "@alliance/shared/lib/useUserSelection";
import {
  useSelectableUsers,
  type UserSelectUser,
} from "@alliance/sharedweb/ui/UserSelect";
import { X } from "lucide-react";
import React, { useId, useMemo, useState } from "react";
import { AvatarProfile } from "./Avatar";
import { cn } from "./cn";
import { Input } from "./Input";
import { popupClass } from "./styles";

// A data hook and its type, not a visual: the shared one serves.
export { useSelectableUsers, type UserSelectUser };

interface UserSelectProps {
  users: UserSelectUser[];
  selectedUserIds: number[];
  onChange: (userIds: number[]) => void;
  loading?: boolean;
  loadFailed?: boolean;
  label?: string | null;
  single?: boolean;
}

const nameOf = (user: UserSelectUser) => user.name;
const displayName = (user: UserSelectUser) => user.name ?? `User #${user.id}`;
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
  loadFailed = false,
  label = "Recipients",
  single = false,
}) => {
  const inputId = useId();
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
        <label
          htmlFor={inputId}
          className="mb-1 block text-body font-medium text-fg"
        >
          {label}
        </label>
      )}
      {canSelectMore && (
        <Input
          id={inputId}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          disabled={inputDisabled}
        />
      )}
      {query && filteredUsers.length > 0 && (
        <div
          className={cn(
            popupClass,
            "absolute left-0 z-10 mt-1 max-h-48 w-full overflow-y-auto p-1",
          )}
        >
          {filteredUsers.map((user) => (
            <button
              type="button"
              key={user.id}
              className="flex w-full flex-row items-center gap-x-2 rounded-sm px-2 py-1 text-left focus-ring hover:bg-surface-2"
              onClick={() => addUser(user.id)}
            >
              <AvatarProfile pfp={user.profilePicture} size="medium" />
              <span className="font-medium">{displayName(user)}</span>
            </button>
          ))}
        </div>
      )}
      {loadFailed && (
        <p className="mt-2 text-caption text-danger">Failed to load users.</p>
      )}
      {query && !filteredUsers.length && !loading && !loadFailed && (
        <p className="mt-2 text-caption text-fg-muted">
          No users match that search.
        </p>
      )}
      {selectedUsers.length > 0 && (
        <div className="my-1 flex items-center gap-2">
          {filterOpen ? (
            <>
              <Input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter selected users..."
                className="h-control-sm flex-1"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  setFilterOpen(false);
                  setFilterQuery("");
                }}
                className="rounded-sm text-caption text-fg-muted focus-ring hover:text-fg"
              >
                Clear
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className="rounded-sm text-caption text-fg-muted focus-ring hover:text-fg"
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
            className="flex items-center justify-between rounded-md border border-line bg-surface-2 px-3 py-2"
          >
            <div className="flex items-center gap-x-2 min-w-0">
              <AvatarProfile pfp={user.profilePicture} size="medium" />
              <p className="font-medium truncate">{displayName(user)}</p>
            </div>
            <button
              type="button"
              onClick={() => removeUser(user.id)}
              aria-label={`Remove ${displayName(user)}`}
              className="ml-1 shrink-0 rounded-sm text-fg-muted focus-ring hover:text-danger"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        ))}
        {selectedUsers.length === 0 && !single && (
          <p className="text-caption text-fg-muted">
            Selected users will appear here.
          </p>
        )}
      </div>
    </div>
  );
};

export default UserSelect;
