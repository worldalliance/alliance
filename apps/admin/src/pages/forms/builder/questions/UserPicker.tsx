import { useUsersAdmin } from "../../../../lib/useUsersAdmin";
import UserSelect, { type UserSelectUser } from "../../../../ui/UserSelect";

export type PickedUser = {
  userId: number;
  userName: string;
  userProfilePicture?: string | null;
};

/**
 * One user from the admin's user list, picked by name or id, by keyboard or
 * pointer.
 */
export function UserPicker({
  label,
  selected,
  onChange,
}: {
  label: string;
  selected: PickedUser | null;
  onChange: (user: PickedUser | null) => void;
}) {
  const usersQuery = useUsersAdmin();
  const users = usersQuery.data ?? [];
  // A pick the list no longer holds still shows by the name stored with it.
  const shown: UserSelectUser[] =
    selected && !users.some((user) => user.id === selected.userId)
      ? [
          ...users,
          {
            id: selected.userId,
            name: selected.userName,
            profilePicture: selected.userProfilePicture ?? null,
          },
        ]
      : users;
  return (
    <UserSelect
      users={shown}
      selectedUserIds={selected ? [selected.userId] : []}
      onChange={([userId]) => {
        const user = users.find((candidate) => candidate.id === userId);
        onChange(
          user
            ? {
                userId: user.id,
                userName: user.name ?? `User #${user.id}`,
                userProfilePicture: user.storedProfilePicture,
              }
            : null,
        );
      }}
      loading={usersQuery.isLoading}
      loadFailed={usersQuery.isLoadingError}
      label={label}
      single
    />
  );
}
