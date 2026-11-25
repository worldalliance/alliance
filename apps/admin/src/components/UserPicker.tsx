import { type AdminUserListItemDto } from "@alliance/shared/client";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { useMemo, useState } from "react";
import { useUsersAdmin } from "../lib/useUsersAdmin";

export type PickedUser = {
  userId: number;
  userName: string;
  userProfilePicture?: string | null;
};

type ShownUser = Pick<AdminUserListItemDto, "id" | "name" | "profilePicture">;

export function UserPicker({
  selected,
  onChange,
}: {
  selected: PickedUser | null;
  onChange: (user: PickedUser | null) => void;
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
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AvatarProfile
              pfp={selectedUser.profilePicture ?? null}
              size="medium"
            />
            <span className="font-medium text-zinc-900 truncate">
              {selectedUser.name ?? `User #${selectedUser.id}`}
            </span>
          </div>
          <button
            type="button"
            onClick={clearUser}
            className="text-xs text-red-600 hover:text-red-700 shrink-0"
          >
            Clear
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              isLoadingUsers
                ? "Loading users…"
                : "(Optional) Select user by name or id"
            }
            disabled={isLoadingUsers}
            className="w-full border border-zinc-300 rounded px-3 py-2 text-sm bg-white disabled:bg-zinc-50 disabled:text-zinc-500"
          />
          {query && filteredUsers.length > 0 && (
            <div className="border border-zinc-200 rounded bg-white max-h-48 overflow-y-auto absolute left-0 w-full z-10 mt-1 shadow-sm">
              {filteredUsers.map((user) => (
                <button
                  type="button"
                  key={user.id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 flex flex-row items-center gap-x-2"
                  onClick={() => selectUser(user)}
                >
                  <AvatarProfile pfp={user.profilePicture} size="medium" />
                  <span className="font-medium truncate">
                    {user.name ?? `User #${user.id}`}
                  </span>
                  <span className="text-xs text-zinc-400 shrink-0">
                    #{user.id}
                  </span>
                </button>
              ))}
            </div>
          )}
          {query && !filteredUsers.length && !isLoadingUsers && (
            <p className="mt-1 text-xs text-zinc-500">
              No users match that search.
            </p>
          )}
        </div>
      )}
    </>
  );
}
