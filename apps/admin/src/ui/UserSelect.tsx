import {
  matchesName,
  useUserSelection,
} from "@alliance/shared/lib/useUserSelection";
import {
  useSelectableUsers,
  type UserSelectUser,
} from "@alliance/sharedweb/ui/UserSelect";
import { Combobox as Primitive } from "@base-ui/react/combobox";
import { X } from "lucide-react";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { AvatarProfile } from "./Avatar";
import { cn } from "./cn";
import { Input } from "./Input";
import { optionClass } from "./option";
import { controlClass, popupClass } from "./styles";
import { useFocusAfterRemoval } from "./useFocusAfterRemoval";
import { zIndex } from "./zIndex";

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
  /** Shows the picks but takes no search and no removal. */
  disabled?: boolean;
  /**
   * One line shown while nothing is picked. A multi-pick has its own unless
   * this replaces it; a single pick has none.
   */
  hint?: string;
  /**
   * `Field`'s control props: pass `label={null}` and spread them, as for
   * `Combobox`. Without `id` the select labels itself.
   */
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  /** How to fix it, for a caller that isn't in `Field`. */
  error?: string | null;
}

const MAX_OPTIONS = 50;

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
  disabled = false,
  hint = single ? undefined : "Selected users will appear here.",
  id,
  "aria-describedby": describedByProp,
  "aria-invalid": invalidProp,
  error,
}) => {
  const ownId = useId();
  const inputId = id ?? ownId;
  const errorId = `${ownId}-error`;
  const describedBy =
    [describedByProp, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;
  const inputRef = useRef<HTMLInputElement>(null);
  const [filterQuery, setFilterQuery] = useState<string>("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [focusPick, setFocusPick] = useState(false);
  const {
    query,
    setQuery,
    canSelectMore,
    selectedUsers,
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
  const { row, removing } = useFocusAfterRemoval({
    ids: selectedUserIds,
    fallback: inputRef,
  });

  // A single pick unmounts the search; focus follows to the row that took its place.
  useEffect(() => {
    if (!focusPick || selectedUsers.length === 0) return;
    document
      .querySelector<HTMLElement>(`[data-user-select="${ownId}"] button`)
      ?.focus();
    setFocusPick(false);
  }, [focusPick, selectedUsers.length, ownId]);

  const options = useMemo(() => {
    if (!canSelectMore) return [];
    const picked = new Set(selectedUserIds);
    return users
      .filter(
        (user) => !picked.has(user.id) && matchesName(nameOf(user), query),
      )
      .slice(0, MAX_OPTIONS);
  }, [users, selectedUserIds, query, canSelectMore]);

  const displayedSelectedUsers = useMemo(() => {
    if (!filterQuery.trim()) return selectedUsers;
    return selectedUsers.filter((user) => matchesName(user.name, filterQuery));
  }, [selectedUsers, filterQuery]);

  return (
    <div>
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1 block text-body font-medium text-fg"
        >
          {label}
        </label>
      )}
      {canSelectMore && (
        <Primitive.Root<UserSelectUser>
          items={options}
          value={null}
          onValueChange={(user) => {
            if (!user) return;
            addUser(user.id);
            if (single) setFocusPick(true);
          }}
          inputValue={query}
          onInputValueChange={(value, details) => {
            // Picking writes the name into the input; the search clears instead.
            if (details.reason !== "item-press") setQuery(value);
          }}
          itemToStringLabel={displayName}
          isItemEqualToValue={(a, b) => a.id === b.id}
          filter={null}
          autoHighlight
          disabled={disabled || inputDisabled}
        >
          <Primitive.Input
            ref={inputRef}
            id={inputId}
            aria-describedby={describedBy}
            aria-invalid={invalidProp ?? (error ? true : undefined)}
            placeholder={placeholder}
            className={cn(controlClass, "h-control")}
          />
          <Primitive.Portal>
            <Primitive.Positioner
              sideOffset={4}
              align="start"
              className={cn(zIndex.popover, "isolate")}
            >
              <Primitive.Popup
                className={cn(
                  popupClass,
                  "max-h-80 w-anchor min-w-60 overflow-y-auto p-1",
                )}
              >
                <Primitive.Empty className="px-2.5 py-2 text-fg-muted empty:hidden">
                  {loading || loadFailed ? null : "No users match that search."}
                </Primitive.Empty>
                <Primitive.List className="outline-none">
                  {(user: UserSelectUser) => (
                    <Primitive.Item
                      key={user.id}
                      value={user}
                      className={optionClass}
                    >
                      <AvatarProfile pfp={user.profilePicture} size="medium" />
                      <span className="min-w-0 truncate font-medium">
                        {displayName(user)}
                      </span>
                    </Primitive.Item>
                  )}
                </Primitive.List>
              </Primitive.Popup>
            </Primitive.Positioner>
          </Primitive.Portal>
        </Primitive.Root>
      )}
      {loadFailed && (
        <p className="mt-2 text-caption text-danger">Failed to load users.</p>
      )}
      {selectedUsers.length > 0 && !single && (
        <div className="mt-2 flex items-center gap-2">
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
      {(selectedUsers.length > 0 || hint) && (
        <div
          className={cn(
            "mt-2 grid grid-cols-1 gap-2",
            // One pick has the row to itself, so its name isn't cut short.
            !single && "sm:grid-cols-2 lg:grid-cols-3",
          )}
        >
          {displayedSelectedUsers.map((user) => (
            <div
              key={user.id}
              {...row(user.id)}
              data-user-select={single ? ownId : undefined}
              className={cn(
                "flex items-center justify-between rounded-md border border-line bg-surface-2 px-3 py-2",
                disabled && "cursor-not-allowed text-fg-muted",
              )}
            >
              <div className="flex min-w-0 items-center gap-x-2">
                <AvatarProfile
                  pfp={user.profilePicture}
                  size="medium"
                  className={cn(disabled && "opacity-50")}
                />
                <p className="font-medium truncate">{displayName(user)}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const done = removing(user.id);
                  removeUser(user.id);
                  done();
                }}
                disabled={disabled}
                aria-label={`Remove ${displayName(user)}`}
                className="ml-1 shrink-0 rounded-sm text-fg-muted focus-ring not-disabled:hover:text-danger disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={14} aria-hidden />
              </button>
            </div>
          ))}
          {selectedUsers.length === 0 && hint && (
            <p className="col-span-full text-caption text-fg-muted">{hint}</p>
          )}
        </div>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-2 text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
};

export default UserSelect;
