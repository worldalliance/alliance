import { useMemo, useState } from "react";

const MAX_RESULTS = 8;

export const matchesName = (name: string | null | undefined, query: string) =>
  `${name ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());

/** A selected id missing from `users` shows in `selectedUsers` as `missingUser(id)`, so it can still be seen and removed. */
export function useUserSelection<User extends { id: number }>(params: {
  users: User[];
  selectedUserIds: number[];
  onChange: (userIds: number[]) => void;
  nameOf: (user: User) => string | null | undefined;
  missingUser: (userId: number) => User;
  loading: boolean;
  single: boolean;
}) {
  const {
    users,
    selectedUserIds,
    onChange,
    nameOf,
    missingUser,
    loading,
    single,
  } = params;
  const [query, setQuery] = useState("");

  const selectedUsers = useMemo(() => {
    const userMap = new Map(users.map((user) => [user.id, user]));
    return selectedUserIds.map(
      (userId) => userMap.get(userId) ?? missingUser(userId),
    );
  }, [users, selectedUserIds, missingUser]);

  const canSelectMore = !single || selectedUserIds.length === 0;

  const filteredUsers = useMemo(() => {
    if (!canSelectMore) {
      return [];
    }
    if (!query.trim()) {
      return [];
    }
    const selectedIds = new Set(selectedUserIds);
    return users
      .filter((user) => !selectedIds.has(user.id))
      .filter((user) => matchesName(nameOf(user), query))
      .slice(0, MAX_RESULTS);
  }, [query, users, selectedUserIds, canSelectMore, nameOf]);

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

  return {
    query,
    setQuery,
    canSelectMore,
    selectedUsers,
    filteredUsers,
    addUser,
    removeUser,
    inputDisabled,
    placeholder,
  };
}
