import { type AdminUserListItemDto } from "@alliance/shared/client";
import { useMemo, useState } from "react";
import { useUsersAdmin } from "../lib/useUsersAdmin";
import { AvatarProfile } from "../ui/Avatar";
import Button, { ButtonVariant } from "../ui/Button";
import { cn } from "../ui/cn";
import { Input } from "../ui/Input";
import { popupClass } from "../ui/styles";

export type PickedUser = {
  userId: number;
  userName: string;
  userProfilePicture?: string | null;
};

type ShownUser = Pick<AdminUserListItemDto, "id" | "name" | "profilePicture">;

export function UserPicker({
  selected,
  onChange,
  placeholder = "(Optional) Select user by name or id",
  ariaLabel,
}: {
  selected: PickedUser | null;
  onChange: (user: PickedUser | null) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const { data: users = [], isLoading: isLoadingUsers } = useUsersAdmin();
  const [query, setQuery] = useState("");

  const selectedUser = useMemo((): ShownUser | null => {
    if (selected?.userId == null) return null;
    const match = users.find((user) => user.id === selected?.userId);
    if (match) {
      return {
        id: match.id,
        name: match.name,
        profilePicture: match.profilePicture,
      };
    }
    return {
      id: selected?.userId,
      name: selected?.userName ?? `User #${selected?.userId}`,
      profilePicture: selected?.userProfilePicture ?? null,
    };
  }, [
    selected?.userId,
    selected?.userName,
    selected?.userProfilePicture,
    users,
  ]);

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return users
      .filter((user) => {
        if (selected?.userId != null && user.id === selected?.userId) {
          return false;
        }
        const byName = (user.name ?? "").toLowerCase().includes(term);
        const byId = String(user.id).includes(term);
        return byName || byId;
      })
      .slice(0, 8);
  }, [selected?.userId, query, users]);

  const selectUser = (user: AdminUserListItemDto) => {
    onChange({
      userId: user.id,
      userName: user.name ?? `User #${user.id}`,
      userProfilePicture: user.storedProfilePicture,
    });
    setQuery("");
  };

  const clearUser = () => {
    onChange(null);
  };

  return (
    <>
      {selectedUser ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-line bg-surface-2 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <AvatarProfile
              pfp={selectedUser.profilePicture ?? null}
              size="medium"
            />
            <span className="truncate font-medium">
              {selectedUser.name ?? `User #${selectedUser.id}`}
            </span>
          </div>
          <Button
            variant={ButtonVariant.Ghost}
            size="small"
            onClick={clearUser}
            aria-label={ariaLabel ? `Clear ${ariaLabel}` : "Clear"}
          >
            Clear
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={ariaLabel}
            placeholder={isLoadingUsers ? "Loading users…" : placeholder}
            disabled={isLoadingUsers}
          />
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
                  onClick={() => selectUser(user)}
                >
                  <AvatarProfile pfp={user.profilePicture} size="medium" />
                  <span className="truncate font-medium">
                    {user.name ?? `User #${user.id}`}
                  </span>
                  <span className="shrink-0 text-caption text-fg-muted">
                    #{user.id}
                  </span>
                </button>
              ))}
            </div>
          )}
          {query && !filteredUsers.length && !isLoadingUsers && (
            <p className="mt-1 text-caption text-fg-muted">
              No users match that search.
            </p>
          )}
        </div>
      )}
    </>
  );
}
