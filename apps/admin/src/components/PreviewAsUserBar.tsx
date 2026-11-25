import type { UserDto } from "@alliance/shared/client";
import UserSelect from "../ui/UserSelect";

export interface PreviewAsUserBarProps {
  previewUserId: string;
  setPreviewUserId: (value: string) => void;
  previewUsers: UserDto[];
  isLoadingPreviewUsers: boolean;
  previewUserError: string | null;
}

export function PreviewAsUserBar({
  previewUserId,
  setPreviewUserId,
  previewUsers,
  isLoadingPreviewUsers,
  previewUserError,
}: PreviewAsUserBarProps) {
  const selectedUserIds =
    previewUserId === "preview" ? [] : [Number(previewUserId)];

  const handleChange = (userIds: number[]) => {
    setPreviewUserId(userIds.length > 0 ? String(userIds[0]) : "preview");
  };

  return (
    <div className="mb-4">
      <UserSelect
        users={previewUsers}
        selectedUserIds={selectedUserIds}
        onChange={handleChange}
        loading={isLoadingPreviewUsers}
        label="Preview as"
        single
      />
      {previewUserError && (
        <span className="text-xs text-red-600">{previewUserError}</span>
      )}
    </div>
  );
}
