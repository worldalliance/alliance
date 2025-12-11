import { ProfileDto, userMembers } from "@alliance/shared/client";
import Button, { ButtonColor } from "@alliance/shared/ui/Button";
import ProfileImage from "@alliance/shared/ui/ProfileImage";
import { X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";

export type UserSelectUser = Pick<
  ProfileDto,
  "id" | "displayName" | "profilePicture"
>;

interface MessageRecipientSelectProps {
  users: UserSelectUser[];
  selectedUserIds: number[];
  onChange: (userIds: number[]) => void;
  loading?: boolean;
  single?: boolean;
}

const MAX_RESULTS = 8;

const MessageRecipientSelect: React.FC<MessageRecipientSelectProps> = ({
  users,
  selectedUserIds,
  onChange,
  loading = false,
  single = false,
}) => {
  const [query, setQuery] = useState<string>("");

  const canSelectMore = !single || selectedUserIds.length === 0;

  const selectedUsers = useMemo(() => {
    const userMap = new Map(users.map((user) => [user.id, user]));
    return selectedUserIds.map((userId) => userMap.get(userId)!);
  }, [users, selectedUserIds]);

  const filteredUsers = useMemo(() => {
    if (!canSelectMore) {
      return [];
    }

    const term = query.trim().toLowerCase();
    if (!term) {
      return [];
    }

    const selectedIds = new Set(selectedUserIds);
    return users
      .filter((user) => !selectedIds.has(user.id))
      .filter((user) => {
        const haystack = `${user.displayName ?? ""}`.toLowerCase();
        return haystack.includes(term);
      })
      .slice(0, MAX_RESULTS);
  }, [query, users, selectedUserIds, canSelectMore]);

  const addUser = (userId: number) => {
    if (selectedUserIds.includes(userId)) {
      return;
    }
    if (single) {
      onChange([userId]);
    } else {
      onChange([...selectedUserIds, userId]);
    }
    setQuery("");
  };

  const removeUser = (userId: number) => {
    onChange(selectedUserIds.filter((id) => id !== userId));
  };

  const inputDisabled = loading || !canSelectMore;
  const placeholder = loading
    ? "Loading users…"
    : canSelectMore
    ? "Search by name"
    : "Remove current selection to choose another";

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (
      event.key === "Backspace" &&
      event.currentTarget.value.length === 0 &&
      selectedUsers.length > 0
    ) {
      removeUser(selectedUsers[selectedUsers.length - 1].id);
      event.preventDefault();
    }
  };

  return (
    <div className="relative flex flex-row items-center gap-2 flex-wrap">
      {selectedUsers.map((user) => (
        <div
          className="flex items-center justify-between rounded px-1 py-1 text-sm bg-zinc-100 shrink-0"
          key={user.id}
        >
          <div className="flex items-center gap-x-2">
            <ProfileImage pfp={user.profilePicture} size="medium" />
            <p className="font-medium">{user.displayName}</p>
          </div>
          <Button
            color={ButtonColor.Transparent}
            onClick={() => removeUser(user.id)}
          >
            <X size="16" />
          </Button>
        </div>
      ))}
      <div className="relative">
        {canSelectMore && (
          <input
            type="text"
            key={selectedUsers.length}
            value={query}
            onKeyDown={handleKeyDown}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            autoFocus
            disabled={inputDisabled}
            className="border-zinc-300 rounded-md py-2.5 disabled:bg-zinc-100 disabled:text-zinc-500 focus:outline-none min-w-48 text-[16px]"
          />
        )}
        {query && filteredUsers.length > 0 && (
          <div className="border border-zinc-200 rounded bg-white max-h-48 overflow-y-auto absolute w-full top-full shadow">
            {filteredUsers.map((user) => (
              <button
                type="button"
                key={user.id}
                className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 flex flex-row items-center gap-x-2"
                onClick={() => addUser(user.id)}
              >
                <ProfileImage pfp={user.profilePicture} size="medium" />
                <span className="font-medium whitespace-nowrap">
                  {user.displayName}
                </span>
              </button>
            ))}
          </div>
        )}
        {query && !filteredUsers.length && !loading && (
          <div className="border border-zinc-200 rounded bg-white max-h-48 overflow-y-auto absolute w-full top-full shadow">
            <p className="px-3 py-2 ml-2 text-sm text-zinc-500">
              No members found
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageRecipientSelect;

export const useSelectableUserIds = () => {
  const [users, setUsers] = useState<UserSelectUser[]>([]);
  useEffect(() => {
    userMembers().then((response) => {
      setUsers(
        response.data?.map((user) => ({
          id: user.id,
          displayName: user.displayName,
          profilePicture: user.profilePicture,
        })) ?? []
      );
    });
  }, []);
  return users;
};
