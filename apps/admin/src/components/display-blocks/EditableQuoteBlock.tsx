import type { QuoteBlock } from "@alliance/common/forms/display-blocks";
import { userListAdmin, type UserDto } from "@alliance/shared/client";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { useEffect, useMemo, useState } from "react";
import FormTextarea from "../FormTextarea";
import { DisplayBlockWrapper } from "./DisplayBlockWrapper";
import type { BaseDisplayBlockProps } from "./types";

type QuoteUser = Pick<UserDto, "id" | "name" | "profilePicture">;

function QuoteBlockEditor({
  activeBlock,
  onUpdate,
}: {
  activeBlock: QuoteBlock;
  onUpdate: (updates: Partial<QuoteBlock>) => void;
}) {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setIsLoadingUsers(true);
    userListAdmin()
      .then((response) => {
        if (cancelled) return;
        setUsers(response.data ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setUsers([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingUsers(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedUser = useMemo((): QuoteUser | null => {
    if (activeBlock.userId == null) return null;
    const match = users.find((user) => user.id === activeBlock.userId);
    if (match) {
      return {
        id: match.id,
        name: match.name,
        profilePicture: match.profilePicture,
      };
    }
    return {
      id: activeBlock.userId,
      name: activeBlock.userName ?? `User #${activeBlock.userId}`,
      profilePicture: activeBlock.userProfilePicture ?? null,
    };
  }, [
    activeBlock.userId,
    activeBlock.userName,
    activeBlock.userProfilePicture,
    users,
  ]);

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return users
      .filter((user) => {
        if (activeBlock.userId != null && user.id === activeBlock.userId) {
          return false;
        }
        const byName = (user.name ?? "").toLowerCase().includes(term);
        const byId = String(user.id).includes(term);
        return byName || byId;
      })
      .slice(0, 8);
  }, [activeBlock.userId, query, users]);

  const selectUser = (user: QuoteUser) => {
    onUpdate({
      userId: user.id,
      userName: user.name ?? `User #${user.id}`,
      userProfilePicture: user.profilePicture ?? null,
    });
    setQuery("");
  };

  const clearUser = () => {
    onUpdate({
      userId: undefined,
      userName: undefined,
      userProfilePicture: undefined,
    });
  };

  return (
    <div className="space-y-3 bg-zinc-100 px-5 py-4">
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
      <FormTextarea
        value={activeBlock.text}
        onChange={(e) => onUpdate({ text: e.target.value })}
        className="w-full text-gray-900 border-none outline-none !bg-transparent resize-none whitespace-pre-wrap"
        placeholder="Enter quote text"
        rows={Math.max(2, activeBlock.text.split("\n").length)}
        style={{ resize: "vertical" }}
      />
    </div>
  );
}

export function EditableQuoteBlock(props: BaseDisplayBlockProps<QuoteBlock>) {
  return (
    <DisplayBlockWrapper {...props}>
      {({ block: activeBlock, onUpdate: handleUpdate }) => (
        <QuoteBlockEditor activeBlock={activeBlock} onUpdate={handleUpdate} />
      )}
    </DisplayBlockWrapper>
  );
}
